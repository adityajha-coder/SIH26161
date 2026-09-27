"""
scripts/gis/generate_display_tiles.py

Generates web map display assets for MapLibre GL JS:
1. Mapbox Terrain-RGB raster tiles (zooms 8-12) for 3D digital elevation rendering.
2. Hillshade raster tiles (zooms 8-12) for terrain visualization.
3. 100m interval elevation contours as GeoJSON for vector contour overlay.
4. Tile manifest with bounding boxes and metadata.
"""

import os
import sys
import math
import json
import time
import argparse
from pathlib import Path
from collections import defaultdict

import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling, transform_bounds, transform
from rasterio.transform import from_bounds, Affine
import warnings

# Suppress GDAL non-georeferenced PNG warnings during tile output
warnings.filterwarnings("ignore", category=UserWarning, module="rasterio")

# Constants for Web Mercator (EPSG:3857)
ORIGIN_SHIFT = 20037508.342789244

def deg2num(lat_deg: float, lon_deg: float, zoom: int) -> tuple[int, int]:
    """Convert WGS84 lat/lon to slippy map tile x, y."""
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile

def tile_bounds_3857(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    """Calculate Web Mercator (EPSG:3857) bounding box [minx, miny, maxx, maxy] for tile (z, x, y)."""
    tile_size = 2 * ORIGIN_SHIFT / (2 ** z)
    minx = -ORIGIN_SHIFT + x * tile_size
    maxx = -ORIGIN_SHIFT + (x + 1) * tile_size
    maxy = ORIGIN_SHIFT - y * tile_size
    miny = ORIGIN_SHIFT - (y + 1) * tile_size
    return minx, miny, maxx, maxy

def encode_terrain_rgb(elev_data: np.ndarray, nodata_val: float = -9999.0) -> np.ndarray:
    """
    Encode elevation in meters to Mapbox Terrain-RGB format:
    h = -10000 + (R * 65536 + G * 256 + B) * 0.1
    Returns uint8 array of shape (4, H, W) [R, G, B, A].
    """
    valid = (elev_data > -9000.0) & (~np.isnan(elev_data))
    rgba = np.zeros((4, elev_data.shape[0], elev_data.shape[1]), dtype=np.uint8)
    
    val = np.round((elev_data + 10000.0) * 10.0).astype(np.int32)
    val = np.clip(val, 0, 16777215)
    
    rgba[0] = np.where(valid, (val // 65536) % 256, 0).astype(np.uint8)
    rgba[1] = np.where(valid, (val // 256) % 256, 0).astype(np.uint8)
    rgba[2] = np.where(valid, val % 256, 0).astype(np.uint8)
    rgba[3] = np.where(valid, 255, 0).astype(np.uint8)
    return rgba

def encode_hillshade_rgba(hillshade_data: np.ndarray, valid_mask: np.ndarray) -> np.ndarray:
    """
    Encode grayscale hillshade (0-255) to RGBA tile with transparency for void/nodata.
    """
    rgba = np.zeros((4, hillshade_data.shape[0], hillshade_data.shape[1]), dtype=np.uint8)
    rgba[0] = np.where(valid_mask, hillshade_data, 0).astype(np.uint8)
    rgba[1] = np.where(valid_mask, hillshade_data, 0).astype(np.uint8)
    rgba[2] = np.where(valid_mask, hillshade_data, 0).astype(np.uint8)
    rgba[3] = np.where(valid_mask, 255, 0).astype(np.uint8)
    return rgba

EDGE_PAIRS = {
    1: [(3, 2)],
    2: [(2, 1)],
    3: [(3, 1)],
    4: [(0, 1)],
    5: [(0, 3), (2, 1)],
    6: [(0, 2)],
    7: [(0, 3)],
    8: [(0, 3)],
    9: [(0, 2)],
    10: [(0, 1), (3, 2)],
    11: [(0, 1)],
    12: [(3, 1)],
    13: [(2, 1)],
    14: [(3, 2)]
}

def extract_level_segments(sub_dem: np.ndarray, level: float):
    """Extract line segments for a contour elevation level using Marching Squares."""
    tl_v = sub_dem[:-1, :-1]
    tr_v = sub_dem[:-1, 1:]
    br_v = sub_dem[1:, 1:]
    bl_v = sub_dem[1:, :-1]

    tl = tl_v >= level
    tr = tr_v >= level
    br = br_v >= level
    bl = bl_v >= level

    code = (tl.astype(int) << 3) | (tr.astype(int) << 2) | (br.astype(int) << 1) | bl.astype(int)
    rows, cols = np.where((code > 0) & (code < 15))
    if len(rows) == 0:
        return []

    lines = []
    for r, c in zip(rows, cols):
        cd = code[r, c]
        v_tl, v_tr, v_br, v_bl = tl_v[r, c], tr_v[r, c], br_v[r, c], bl_v[r, c]
        if any(x < -9000 for x in (v_tl, v_tr, v_br, v_bl)):
            continue
        
        pairs = EDGE_PAIRS.get(cd, [])
        for e_start, e_end in pairs:
            def edge_pt(e):
                if e == 0:
                    t = (level - v_tl) / (v_tr - v_tl + 1e-9)
                    return (r, c + t)
                elif e == 1:
                    t = (level - v_tr) / (v_br - v_tr + 1e-9)
                    return (r + t, c + 1)
                elif e == 2:
                    t = (level - v_bl) / (v_br - v_bl + 1e-9)
                    return (r + 1, c + t)
                elif e == 3:
                    t = (level - v_tl) / (v_bl - v_tl + 1e-9)
                    return (r + t, c)
            p1 = edge_pt(e_start)
            p2 = edge_pt(e_end)
            lines.append((p1, p2))
    return lines

def stitch_segments_into_lines(segments, tol: int = 2):
    """Chain disconnected 2-point segments into continuous polylines."""
    def q(pt):
        return (round(pt[0], tol), round(pt[1], tol))

    adj = defaultdict(list)
    for i, (p1, p2) in enumerate(segments):
        q1, q2 = q(p1), q(p2)
        adj[q1].append((q2, p1, p2, i))
        adj[q2].append((q1, p2, p1, i))

    visited = set()
    polylines = []

    for i, (p1, p2) in enumerate(segments):
        if i in visited:
            continue
        visited.add(i)
        line = [p1, p2]
        
        # Extend forward
        curr = q(p2)
        while True:
            candidates = [it for it in adj[curr] if it[3] not in visited]
            if not candidates:
                break
            nxt_q, _, nxt_end, seg_idx = candidates[0]
            visited.add(seg_idx)
            line.append(nxt_end)
            curr = nxt_q
            
        # Extend backward
        curr = q(p1)
        while True:
            candidates = [it for it in adj[curr] if it[3] not in visited]
            if not candidates:
                break
            nxt_q, _, nxt_end, seg_idx = candidates[0]
            visited.add(seg_idx)
            line.insert(0, nxt_end)
            curr = nxt_q

        if len(line) >= 4:
            polylines.append(line)
    return polylines

def generate_contours_geojson(dem_path: Path, out_path: Path, interval: int = 100, step: int = 4):
    """Generate GeoJSON contour lines from DEM."""
    print(f"Generating {interval}m interval elevation contours (subsampling step={step})...")
    with rasterio.open(dem_path) as src:
        dem = src.read(1)
        crs = src.crs
        orig_trans = src.transform

    sub = dem[::step, ::step].astype(np.float64)
    sub_trans = orig_trans * Affine.scale(step, step)
    
    valid_mask = sub > -9000
    if not np.any(valid_mask):
        print("Error: No valid elevation data for contours.")
        return

    min_elev = int(np.floor(np.min(sub[valid_mask]) / interval) * interval)
    max_elev = int(np.ceil(np.max(sub[valid_mask]) / interval) * interval)
    
    # Restrict to meaningful bounds
    min_elev = max(min_elev, 200)
    max_elev = min(max_elev, 3000)
    levels = list(range(min_elev + interval, max_elev, interval))
    
    print(f"Extracting contours from {min_elev + interval}m to {max_elev - interval}m ({len(levels)} levels)...")
    
    features = []
    total_lines = 0
    t0 = time.time()
    
    for lvl in levels:
        segs = extract_level_segments(sub, float(lvl))
        if not segs:
            continue
        polys = stitch_segments_into_lines(segs)
        if not polys:
            continue
            
        for poly in polys:
            # Downsample polyline points if dense
            if len(poly) > 10:
                poly = poly[::2] + [poly[-1]]
                
            # Convert (row, col) in sub_dem to metric (x, y)
            cols = [p[1] for p in poly]
            rows = [p[0] for p in poly]
            
            # Affine transformation
            xs = sub_trans.c + np.array(cols) * sub_trans.a + np.array(rows) * sub_trans.b
            ys = sub_trans.f + np.array(cols) * sub_trans.d + np.array(rows) * sub_trans.e
            
            # Reproject to WGS84 lon, lat
            lons, lats = transform(crs, "EPSG:4326", xs, ys)
            coords = [[round(lon, 5), round(lat, 5)] for lon, lat in zip(lons, lats)]
            
            if len(coords) < 3:
                continue
                
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords
                },
                "properties": {
                    "ele": lvl,
                    "index": (lvl % 500 == 0)
                }
            })
            total_lines += 1

    geojson_data = {
        "type": "FeatureCollection",
        "name": f"tehri_contours_{interval}m",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
        },
        "features": features
    }
    
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f)
        
    print(f"Generated {total_lines} contour polylines -> {out_path} ({os.path.getsize(out_path):,} bytes in {time.time()-t0:.2f}s)")

def generate_tiles(dem_path: Path, hillshade_path: Path, out_dir: Path, min_zoom: int = 8, max_zoom: int = 12):
    """Generate Terrain-RGB and Hillshade PNG raster tiles for MapLibre GL JS."""
    t0 = time.time()
    
    terrain_dir = out_dir / "terrain"
    hillshade_dir = out_dir / "hillshade"
    terrain_dir.mkdir(parents=True, exist_ok=True)
    hillshade_dir.mkdir(parents=True, exist_ok=True)
    
    with rasterio.open(dem_path) as src_dem, rasterio.open(hillshade_path) as src_hs:
        # Determine WGS84 bounding box
        wgs_bounds = transform_bounds(src_dem.crs, "EPSG:4326", *src_dem.bounds)
        lon_min, lat_min, lon_max, lat_max = wgs_bounds
        print(f"Corridor WGS84 Extent: [{lon_min:.4f}, {lat_min:.4f}] to [{lon_max:.4f}, {lat_max:.4f}]")
        
        tile_counts = {}
        total_terrain_tiles = 0
        total_hs_tiles = 0
        
        meta = {
            "driver": "PNG",
            "dtype": "uint8",
            "count": 4,
            "width": 256,
            "height": 256
        }
        
        for z in range(min_zoom, max_zoom + 1):
            x_min, y_max = deg2num(lat_min, lon_min, z)
            x_max, y_min = deg2num(lat_max, lon_max, z)
            
            z_terrain = 0
            z_hs = 0
            
            for x in range(x_min, x_max + 1):
                for y in range(y_min, y_max + 1):
                    minx, miny, maxx, maxy = tile_bounds_3857(z, x, y)
                    dst_transform = from_bounds(minx, miny, maxx, maxy, 256, 256)
                    
                    # 1. Terrain-RGB Tile
                    dst_dem = np.full((256, 256), -9999.0, dtype=np.float32)
                    reproject(
                        source=rasterio.band(src_dem, 1),
                        destination=dst_dem,
                        src_transform=src_dem.transform,
                        src_crs=src_dem.crs,
                        dst_transform=dst_transform,
                        dst_crs="EPSG:3857",
                        resampling=Resampling.bilinear,
                        src_nodata=src_dem.nodata,
                        dst_nodata=-9999.0
                    )
                    
                    valid_mask = dst_dem > -9000.0
                    if np.any(valid_mask):
                        terrain_rgba = encode_terrain_rgb(dst_dem)
                        tile_path = terrain_dir / str(z) / str(x) / f"{y}.png"
                        tile_path.parent.mkdir(parents=True, exist_ok=True)
                        with rasterio.open(tile_path, "w", **meta) as dst:
                            dst.write(terrain_rgba)
                        z_terrain += 1
                        
                        # 2. Hillshade Tile
                        dst_hs = np.zeros((256, 256), dtype=np.uint8)
                        reproject(
                            source=rasterio.band(src_hs, 1),
                            destination=dst_hs,
                            src_transform=src_hs.transform,
                            src_crs=src_hs.crs,
                            dst_transform=dst_transform,
                            dst_crs="EPSG:3857",
                            resampling=Resampling.bilinear,
                            src_nodata=src_hs.nodata,
                            dst_nodata=0
                        )
                        hs_rgba = encode_hillshade_rgba(dst_hs, valid_mask)
                        hs_tile_path = hillshade_dir / str(z) / str(x) / f"{y}.png"
                        hs_tile_path.parent.mkdir(parents=True, exist_ok=True)
                        with rasterio.open(hs_tile_path, "w", **meta) as dst:
                            dst.write(hs_rgba)
                        z_hs += 1

            tile_counts[z] = {"terrain": z_terrain, "hillshade": z_hs}
            total_terrain_tiles += z_terrain
            total_hs_tiles += z_hs
            print(f"Zoom {z:2d}: {z_terrain} Terrain-RGB tiles, {z_hs} Hillshade tiles")

    manifest = {
        "case_id": "tehri-dam",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "bounds_wgs84": [round(c, 5) for c in wgs_bounds],
        "zoom_range": [min_zoom, max_zoom],
        "tile_counts": tile_counts,
        "total_terrain_rgb_tiles": total_terrain_tiles,
        "total_hillshade_tiles": total_hs_tiles,
        "tile_format": "256x256 PNG (RGBA)",
        "terrain_encoding": "mapbox",
        "terrain_formula": "height = -10000 + (R * 65536 + G * 256 + B) * 0.1",
        "contours_geojson": "contours.geojson",
        "contours_interval_m": 100
    }
    
    manifest_path = out_dir / "tile_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        
    print(f"\nTile Generation Complete in {time.time()-t0:.2f}s:")
    print(f"- Total Terrain-RGB Tiles: {total_terrain_tiles}")
    print(f"- Total Hillshade Tiles:   {total_hs_tiles}")
    print(f"- Manifest:                {manifest_path}")

def main():
    parser = argparse.ArgumentParser(description="Generate display tiles for MapLibre GL JS")
    parser.add_argument("--dem", default="data/processed/tehri_simulation_domain.tif", help="Path to input DEM GeoTIFF")
    parser.add_argument("--hillshade", default="data/processed/tehri_hillshade.tif", help="Path to input hillshade GeoTIFF")
    parser.add_argument("--out-dir", default="data/processed/tiles", help="Output directory for tiles")
    parser.add_argument("--min-zoom", type=int, default=8, help="Minimum zoom level")
    parser.add_argument("--max-zoom", type=int, default=12, help="Maximum zoom level")
    parser.add_argument("--contour-interval", type=int, default=100, help="Contour elevation interval in meters")
    args = parser.parse_args()

    dem_path = Path(args.dem)
    hillshade_path = Path(args.hillshade)
    out_dir = Path(args.out_dir)

    if not dem_path.exists():
        print(f"Error: DEM file not found at {dem_path}")
        sys.exit(1)
    if not hillshade_path.exists():
        print(f"Error: Hillshade file not found at {hillshade_path}")
        sys.exit(1)

    # 1. Generate Raster Tiles
    generate_tiles(dem_path, hillshade_path, out_dir, args.min_zoom, args.max_zoom)

    # 2. Generate Contour Lines GeoJSON
    contours_path = out_dir / "contours.geojson"
    generate_contours_geojson(dem_path, contours_path, interval=args.contour_interval)

if __name__ == "__main__":
    main()
