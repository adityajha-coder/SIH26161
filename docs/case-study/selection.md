# Case Study Selection: Primary & Secondary Indian River Basins

This document defines the case studies selected for **SIH26161 (Dam Break Inundation Simulation & Earth Observation Platform)**.

---

## 1. Primary Case Study: Tehri Dam & Bhagirathi River

### Selection Rationale
- **Data Completeness**: Comprehensive official engineering records in the **Central Water Commission (CWC) National Register of Large Dams** and **India-WRIS**.
- **Hydraulic & Topographic Dynamic**: The highest dam in India (260.5 m) set in a steep Himalayan gorge opening into the Indo-Gangetic floodplains. This produces strong hydraulic gradients ideal for comparing **Delft3D Flexible Mesh (2D SWE)** and **DualSPHysics (3D SPH)**.
- **Earth Observation Coverage**: Frequent Sentinel-1 SAR orbital tracks with clear radar backscatter contrast across steep valleys and downstream floodplains.

### Dam Specifications (CWC National Register of Large Dams)
- **Dam Name**: Tehri Dam (National Code: `UT09HH0001`)
- **State / District**: Uttarakhand / Tehri Garhwal
- **River Basin**: Ganga Basin / Bhagirathi River
- **Coordinates**: `30.3781° N, 78.4803° E` (EPSG:4326)
- **Type**: Earth and Rock-fill Dam
- **Structural Height**: 260.5 m
- **Crest Length**: 575.0 m
- **Top of Dam Elevation**: 839.5 m a.s.l.
- **Full Reservoir Level (FRL)**: 830.0 m a.s.l.
- **Maximum Water Level (MWL)**: 835.0 m a.s.l.
- **Gross Storage Capacity**: 3,540 MCM (Million Cubic Metres)
- **Effective Storage Capacity**: 2,615 MCM
- **Spillway Type**: Chute spillway + 4 shaft spillways (capacity ~15,300 cumec)
- **Year of Completion**: 2006

### River Reach & Flood Domain Boundary
- **River Reach**: Bhagirathi River from Tehri Dam downstream through Devprayag (confluence with Alaknanda to form Ganga), continuing through Shivpuri, Rishikesh, and Haridwar.
- **Total Reach Length**: ~105 km
- **Bounding Box (WGS84 / EPSG:4326)**:
  - Minimum Longitude: `78.10° E`
  - Minimum Latitude: `29.85° N`
  - Maximum Longitude: `78.75° E`
  - Maximum Latitude: `30.55° N`
- **Key Downstream Vulnerabilities**:
  - Devprayag township & bridge infrastructure
  - Rishikesh urban area & ghats
  - Haridwar holy ghats, barrages, and dense residential zones

---

## 2. Multi-Dam National Benchmark Case Studies

In addition to Tehri Dam, STRATA incorporates 3 major national benchmark dams across India's primary river basins:

1. **Sardar Sarovar Dam (Gujarat)**: Concrete gravity structure on the Narmada River (115 km reach from Kevadiya down to Bharuch and the Gulf of Khambhat; 9,500 MCM gross storage).
2. **Bhakra Dam (Himachal Pradesh)**: High-head concrete gravity dam on the Satluj River (90 km corridor to Nangal Barrage, Anandpur Sahib, and Rupnagar; 9,621 MCM gross storage).
3. **Idukki Arch Dam (Kerala)**: Double-curvature concrete arch dam on the Periyar River (85 km steep Western Ghats reach down to Neriamangalam and Aluva; 1,996 MCM gross storage).

---

## 3. Data Sources & Availability Matrix

| Dataset | Primary Source | Resolution / Format | Availability Status |
|---|---|---|---|
| **Digital Elevation Model (DEM)** | Copernicus GLO-30 / CartoDEM | 30m GeoTIFF | ✅ Verified & Available |
| **Dam Metadata** | CWC NRLD / India-WRIS | Tabular & GeoJSON | ✅ Verified & Available |
| **River Centerlines** | OpenStreetMap / Overpass API | Vector GeoJSON / Shapefile | ✅ Verified & Available |
| **Settlement & Asset Exposure** | OpenStreetMap (OSM) | Vector Points & Polygons | ✅ Verified & Available |
| **Population Density** | WorldPop / Census of India | 100m GeoTIFF / CSV | ✅ Verified & Available |
| **Satellite SAR (Flood Extent)** | Sentinel-1 GRD (Google Earth Engine) | 10m C-band SAR Backscatter | ✅ Verified & Available |
