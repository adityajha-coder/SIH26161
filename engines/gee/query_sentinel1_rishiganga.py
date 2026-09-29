#!/usr/bin/env python3
"""
Direct Google Earth Engine Query:
Discovers genuine Copernicus Sentinel-1 C-SAR GRD scenes
for the Rishi Ganga / Chamoli Disaster of February 7, 2021.
"""

import sys
import os
import json

# Ensure credentials path
sys.path.insert(0, os.path.dirname(__file__))
from gee_monitor import find_credentials, init_earth_engine

def query_rishi_ganga_scenes():
    import ee
    
    cred_path = find_credentials()
    if not cred_path:
        print("[GEE Error] No service account credentials found!")
        return False
        
    with open(cred_path, 'r') as f:
        key_data = json.load(f)
    client_email = key_data.get('client_email')
    
    credentials = ee.ServiceAccountCredentials(client_email, cred_path)
    ee.Initialize(credentials)
    print(f"[GEE] Authenticated with Earth Engine as {client_email}")
    
    # Rishi Ganga / Dhauliganga gorge AOI [min_lon, min_lat, max_lon, max_lat]
    # Centered on Raini village, Tapovan, and Ronti Gad
    aoi = ee.Geometry.BBox(79.55, 30.40, 79.85, 30.60)
    
    print("\n--- Querying Sentinel-1 C-SAR GRD (Jan 15, 2021 to Feb 28, 2021) ---")
    s1 = (
        ee.ImageCollection('COPERNICUS/S1_GRD')
        .filterBounds(aoi)
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
        .filter(ee.Filter.eq('instrumentMode', 'IW'))
        .filterDate('2021-01-15', '2021-02-28')
        .sort('system:time_start')
    )
    
    count = s1.size().getInfo()
    print(f"Total Sentinel-1 acquisitions found over AOI: {count}\n")
    
    scenes = s1.toList(count).getInfo()
    
    results = []
    for item in scenes:
        props = item['properties']
        system_id = item['id']
        time_start = props.get('system:index', '')
        date_str = props.get('date', '')
        orbit_pass = props.get('orbitProperties_pass', '')
        rel_orbit = props.get('relativeOrbitNumber_start', '')
        platform = props.get('platform_number', '')
        
        # Acquisition timestamp in ISO
        millis = props.get('system:time_start', 0)
        from datetime import datetime, timezone
        acq_dt = datetime.fromtimestamp(millis / 1000.0, tz=timezone.utc).isoformat()
        
        info = {
            "system_id": system_id,
            "scene_id": props.get('system:index'),
            "acquisition_utc": acq_dt,
            "orbit_pass": orbit_pass,
            "relative_orbit": rel_orbit,
            "platform": f"Sentinel-1{platform}"
        }
        results.append(info)
        print(f"[{acq_dt}] {system_id}")
        print(f"   Platform: Sentinel-1{platform} | Pass: {orbit_pass} | RelOrbit: {rel_orbit}")
        
    output_path = os.path.join(os.path.dirname(__file__), "rishi_ganga_s1_catalog.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved catalog to {output_path}")
    return results

if __name__ == "__main__":
    query_rishi_ganga_scenes()
