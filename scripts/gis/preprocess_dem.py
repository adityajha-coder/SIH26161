"""
SIH26161 - Terrain Preprocessing Pipeline
Preprocesses raw Copernicus 30m DEM for hydrodynamic solvers (Delft3D FM, DualSPHysics)
and web visualization.
"""

import os
import sys
import json
import math
import hashlib
import time
from pathlib import Path

import numpy as np
from scipy import ndimage
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.transform import Affine

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
RAW_DEM = ROOT_DIR / "data" / "raw" / "tehri_cop30.tif"
PROCESSED_DIR = ROOT_DIR / "data" / "processed"
DOCS_DIR = ROOT_DIR / "docs" / "case-study"
TARGET_CRS = "EPSG:32644"  # WGS 84 / UTM Zone 44N (Metric)
TARGET_RES = 30.0          # 30 metres

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(8192 * 1024):
            h.update(chunk)
    return h.hexdigest()


def step1_reproject():
    print("\n--- Step 1: Reprojecting to Metric UTM Zone 44N (EPSG:32644) ---")
    out_path = PROCESSED_DIR / "tehri_utm44n.tif"
    
    with rasterio.open(RAW_DEM) as src:
        src_crs = src.crs
        print(f"Source CRS: {src_crs} | Shape: {src.shape}")
        
        transform, width, height = calculate_default_transform(
            src_crs, TARGET_CRS, src.width, src.height, *src.bounds,
            resolution=(TARGET_RES, TARGET_RES)
        )
        
        kwargs = src.meta.copy()
        kwargs.update({
            'crs': TARGET_CRS,
            'transform': transform,
            'width': width,
            'height': height,
            'nodata': -9999.0,
            'dtype': 'float32',
            'compress': 'deflate',
            'tiled': True,
            'blockxsize': 256,
            'blockysize': 256
        })
        
        with rasterio.open(out_path, 'w', **kwargs) as dst:
            reproject(
                source=rasterio.band(src, 1),
                destination=rasterio.band(dst, 1),
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs=TARGET_CRS,
                resampling=Resampling.bilinear,
                dst_nodata=-9999.0
            )

    print(f"Reprojected DEM saved: {out_path} ({out_path.stat().st_size / (1024*1024):.2f} MB)")
    print(f"Projected Dimensions: {width} x {height} pixels at {TARGET_RES}m resolution")
    return out_path


def step2_validate(dem_path: Path):
    print("\n--- Step 2: Validating Elevation and Void Integrity ---")
    with rasterio.open(dem_path) as src:
        dem = src.read(1)
        nodata = src.nodata
        valid_mask = (dem != nodata) & ~np.isnan(dem)
        valid_pixels = dem[valid_mask]
        
        total_pixels = dem.size
        valid_count = int(np.count_nonzero(valid_mask))
        void_count = total_pixels - valid_count
        void_percent = (void_count / total_pixels) * 100.0
        
        min_elev = float(np.min(valid_pixels))
        max_elev = float(np.max(valid_pixels))
        mean_elev = float(np.mean(valid_pixels))
        std_elev = float(np.std(valid_pixels))

        # Checks
        dam_crest_m = 839.5
        min_expected_m = 150.0  # Haridwar plain ~250m
        max_expected_m = 3500.0 # Garhwal peaks ~3000m
        
        checks = {
            "crs_is_metric_utm": src.crs.to_string() == TARGET_CRS,
            "resolution_is_30m": bool(abs(src.res[0] - TARGET_RES) < 1e-2 and abs(src.res[1] - TARGET_RES) < 1e-2),
            "void_percentage_acceptable": bool(void_percent < 5.0),
            "dam_crest_within_range": bool(min_elev < dam_crest_m < max_elev),
            "elevations_physically_sound": bool(min_elev >= min_expected_m and max_elev <= max_expected_m)
        }
        all_passed = all(checks.values())

    report = {
        "dataset": "Copernicus GLO-30 DEM (Tehri - Haridwar Reach)",
        "crs": TARGET_CRS,
        "pixel_size_m": [TARGET_RES, TARGET_RES],
        "grid_dimensions": [src.width, src.height],
        "bounds_utm": {
            "min_x": src.bounds.left,
            "min_y": src.bounds.bottom,
            "max_x": src.bounds.right,
            "max_y": src.bounds.top
        },
        "elevation_metrics_m": {
            "min": round(min_elev, 2),
            "max": round(max_elev, 2),
            "mean": round(mean_elev, 2),
            "std": round(std_elev, 2),
            "dam_crest": dam_crest_m
        },
        "pixel_integrity": {
            "total_pixels": total_pixels,
            "valid_pixels": valid_count,
            "void_pixels": void_count,
            "void_percent": round(void_percent, 4)
        },
        "quality_gates": checks,
        "status": "PASS" if all_passed else "FAIL",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

    report_path = DOCS_DIR / "dem_validation_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Validation Report saved: {report_path}")
    print(f"Status: {report['status']} | Min: {min_elev:.1f}m | Max: {max_elev:.1f}m | Voids: {void_percent:.2f}%")
    return report


def step3_condition(dem_path: Path):
    print("\n--- Step 3: Hydrological Conditioning (Depression & Sink Filling) ---")
    out_path = PROCESSED_DIR / "tehri_conditioned.tif"

    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype(np.float32)
        meta = src.meta.copy()
        nodata = src.nodata

    valid_mask = (dem != nodata) & ~np.isnan(dem)
    
    # Priority flood pit-filling algorithm:
    # An isolated local pit is a cell lower than all its 8 immediate valid neighbours.
    footprint = np.array([[1, 1, 1],
                          [1, 0, 1],
                          [1, 1, 1]], dtype=bool)

    # Minimum of 8-neighbourhood
    min_neighbour = ndimage.minimum_filter(dem, footprint=footprint, mode='reflect')

    # Where cell is lower than all neighbours, raise it to minimum neighbour level + 1cm slope
    pits = (dem < min_neighbour) & valid_mask
    num_pits = int(np.count_nonzero(pits))
    print(f"Identified {num_pits} topological pit artefacts. Applying hydrological conditioning...")

    conditioned = np.copy(dem)
    conditioned[pits] = min_neighbour[pits] + 0.01

    with rasterio.open(out_path, 'w', **meta) as dst:
        dst.write(conditioned, 1)

    print(f"Conditioned DEM saved: {out_path} ({out_path.stat().st_size / (1024*1024):.2f} MB)")
    return out_path


def step4_clip_domain(dem_path: Path):
    print("\n--- Step 4: Clipping to Downstream Hydraulic Simulation Domain ---")
    out_path = PROCESSED_DIR / "tehri_simulation_domain.tif"

    with rasterio.open(dem_path) as src:
        # Downstream corridor from Tehri Reservoir (North-East) to Haridwar Plain (South-West)
        # In UTM 44N:
        # X: ~225,000m to 290,000m Easting
        # Y: ~3,300,000m to 3,365,000m Northing
        bounds = src.bounds
        clip_min_x = max(bounds.left, 222000.0)
        clip_max_x = min(bounds.right, 290000.0)
        clip_min_y = max(bounds.bottom, 3300000.0)
        clip_max_y = min(bounds.top, 3365000.0)

        # Convert coordinates to pixel windows
        row_start, col_start = src.index(clip_min_x, clip_max_y)
        row_stop, col_stop = src.index(clip_max_x, clip_min_y)

        # Clamp indices
        row_start = max(0, min(row_start, src.height - 1))
        row_stop = max(0, min(row_stop, src.height))
        col_start = max(0, min(col_start, src.width - 1))
        col_stop = max(0, min(col_stop, src.width))

        clip_window = rasterio.windows.Window(
            col_off=col_start,
            row_off=row_start,
            width=col_stop - col_start,
            height=row_stop - row_start
        )
        
        clipped_dem = src.read(1, window=clip_window)
        clipped_transform = rasterio.windows.transform(clip_window, src.transform)
        
        meta = src.meta.copy()
        meta.update({
            'width': clip_window.width,
            'height': clip_window.height,
            'transform': clipped_transform
        })

        with rasterio.open(out_path, 'w', **meta) as dst:
            dst.write(clipped_dem, 1)

    print(f"Hydraulic domain DEM clipped: {out_path} ({clip_window.width}x{clip_window.height} cells)")
    return out_path


def step5_derivatives(dem_path: Path):
    print("\n--- Step 5: Deriving Support Layers (Slope, Aspect, Hillshade, Flow Direction) ---")
    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype(np.float32)
        meta = src.meta.copy()
        nodata = src.nodata

    valid = (dem != nodata) & ~np.isnan(dem)
    dem_clean = np.where(valid, dem, np.median(dem[valid]))

    # Gradients in x and y (cell size 30m)
    dy, dx = np.gradient(dem_clean, TARGET_RES, TARGET_RES)

    # 1. Slope (in degrees)
    slope_rad = np.arctan(np.sqrt(dx**2 + dy**2))
    slope_deg = np.degrees(slope_rad).astype(np.float32)
    slope_deg[~valid] = -9999.0

    slope_path = PROCESSED_DIR / "tehri_slope.tif"
    meta_float = meta.copy()
    meta_float.update(dtype='float32', nodata=-9999.0)
    with rasterio.open(slope_path, 'w', **meta_float) as dst:
        dst.write(slope_deg, 1)
    print(f"Slope layer saved: {slope_path}")

    # 2. Hillshade (azimuth 315 deg, altitude 45 deg)
    azimuth_rad = math.radians(315.0)
    altitude_rad = math.radians(45.0)
    aspect_rad = np.arctan2(-dx, dy)
    shaded = (
        np.sin(altitude_rad) * np.cos(slope_rad) +
        np.cos(altitude_rad) * np.sin(slope_rad) * np.cos(azimuth_rad - aspect_rad)
    )
    hillshade = np.clip(255.0 * np.maximum(shaded, 0.0), 0, 255).astype(np.uint8)
    hillshade[~valid] = 0

    hillshade_path = PROCESSED_DIR / "tehri_hillshade.tif"
    meta_byte = meta.copy()
    meta_byte.update(dtype='uint8', nodata=0)
    with rasterio.open(hillshade_path, 'w', **meta_byte) as dst:
        dst.write(hillshade, 1)
    print(f"Hillshade layer saved: {hillshade_path}")

    # 3. D8 Flow Direction (ESRI Encoding: 1=E, 2=SE, 4=S, 8=SW, 16=W, 32=NW, 64=N, 128=NE)
    d8_path = PROCESSED_DIR / "tehri_flowdir.tif"
    d8 = compute_d8_flow_dir(dem_clean, valid)
    with rasterio.open(d8_path, 'w', **meta_byte) as dst:
        dst.write(d8, 1)
    print(f"D8 Flow Direction saved: {d8_path}")

    return {
        "slope": str(slope_path),
        "hillshade": str(hillshade_path),
        "flowdir": str(d8_path)
    }


def compute_d8_flow_dir(dem: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Computes standard D8 flow direction code for each valid cell."""
    shifts = [
        (0, 1, 1),    # E
        (1, 1, 2),    # SE
        (1, 0, 4),    # S
        (1, -1, 8),   # SW
        (0, -1, 16),  # W
        (-1, -1, 32), # NW
        (-1, 0, 64),  # N
        (-1, 1, 128)  # NE
    ]
    diag_dist = math.sqrt(2.0)
    h, w = dem.shape
    d8 = np.zeros((h, w), dtype=np.uint8)
    max_drop = np.zeros((h, w), dtype=np.float32)

    for dr, dc, code in shifts:
        dist = TARGET_RES * (diag_dist if abs(dr) + abs(dc) == 2 else 1.0)
        shifted = np.roll(np.roll(dem, -dr, axis=0), -dc, axis=1)
        drop = (dem - shifted) / dist
        steeper = (drop > max_drop) & (drop > 0) & valid
        d8[steeper] = code
        max_drop[steeper] = drop[steeper]

    d8[~valid] = 0
    return d8


def step6_solver_formats(domain_dem_path: Path):
    print("\n--- Step 6: Generating Solver-Ready Input Formats (Delft3D FM & DualSPHysics) ---")
    
    with rasterio.open(domain_dem_path) as src:
        dem = src.read(1)
        nodata = src.nodata
        valid = (dem != nodata) & ~np.isnan(dem)
        rows, cols = np.where(valid)

        # 1. Delft3D FM Bathymetry / Elevation Sample points (.xyz)
        # Sample every 3rd point along domain to keep initial grid lightweight (~50k points)
        sample_step = 3
        sub_rows = rows[::sample_step]
        sub_cols = cols[::sample_step]
        xs, ys = rasterio.transform.xy(src.transform, sub_rows, sub_cols)
        zs = dem[sub_rows, sub_cols]

        xyz_path = PROCESSED_DIR / "tehri_delft3d.xyz"
        with open(xyz_path, "w", encoding="ascii") as f:
            for x, y, z in zip(xs, ys, zs):
                f.write(f"{x:.2f} {y:.2f} {z:.2f}\n")

        print(f"Delft3D FM .xyz samples saved: {xyz_path} ({len(zs)} points)")

        # 2. DualSPHysics ESRI ASCII Grid (.asc)
        asc_path = PROCESSED_DIR / "tehri_domain.asc"
        with open(asc_path, "w", encoding="ascii") as f:
            f.write(f"ncols         {src.width}\n")
            f.write(f"nrows         {src.height}\n")
            f.write(f"xllcorner     {src.bounds.left:.2f}\n")
            f.write(f"yllcorner     {src.bounds.bottom:.2f}\n")
            f.write(f"cellsize      {TARGET_RES:.2f}\n")
            f.write(f"NODATA_value  -9999\n")
            np.savetxt(f, np.where(valid, dem, -9999), fmt="%.2f")

        print(f"DualSPHysics / Grid .asc saved: {asc_path}")

    return {"delft3d_xyz": str(xyz_path), "ascii_grid": str(asc_path)}


def step7_provenance(outputs: dict):
    print("\n--- Step 7: Recording Processing Provenance & Integrity ---")
    prov = {
        "pipeline_version": "1.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "input": {
            "file": "data/raw/tehri_cop30.tif",
            "source_dataset": "Copernicus GLO-30",
            "sha256": sha256_file(RAW_DEM)
        },
        "target_crs": TARGET_CRS,
        "target_resolution_m": TARGET_RES,
        "outputs": {}
    }

    for name, path_str in outputs.items():
        p = Path(path_str)
        if p.exists():
            prov["outputs"][name] = {
                "file": str(p.relative_to(ROOT_DIR)),
                "size_bytes": p.stat().st_size,
                "sha256": sha256_file(p)
            }

    prov_path = PROCESSED_DIR / "provenance.json"
    with open(prov_path, "w", encoding="utf-8") as f:
        json.dump(prov, f, indent=2)

    print(f"Provenance catalog saved: {prov_path}")
    return prov


def main():
    print("SIH26161: DEM Terrain Preprocessing Pipeline")
    
    t0 = time.time()
    outputs = {}

    reprojected = step1_reproject()
    outputs["reprojected_dem"] = str(reprojected)

    step2_validate(reprojected)

    conditioned = step3_condition(reprojected)
    outputs["conditioned_dem"] = str(conditioned)

    domain = step4_clip_domain(conditioned)
    outputs["simulation_domain_dem"] = str(domain)

    derivs = step5_derivatives(domain)
    outputs.update(derivs)

    solvers = step6_solver_formats(domain)
    outputs.update(solvers)

    step7_provenance(outputs)

    print(f"\nPreprocessing pipeline completed in {time.time() - t0:.2f} seconds!")


if __name__ == "__main__":
    main()
