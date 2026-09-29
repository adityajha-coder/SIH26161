# STRATA — Technical Architecture & Deep Engineering Specification
### Comprehensive Guide to Systems, Microservices, Spatial Databases, Graphics Pipelines & Cloud Infrastructure

> **Platform Designation:** STRATA (Hydroinformatic Intelligence Platform)  
> **Problem Statement Code:** SIH26161 (Smart India Hackathon 2026)  
> **Team:** Goodfella (Team ID: 166091)  
> **Related Documents:** [Master README (`README.md`)](./README.md) · [Mathematical & Physics Engine (`engine.md`)](./engine.md) · [Working on It (`working.md`)](./working.md) · [Architecture Overview (`docs/architecture/overview.md`)](./docs/architecture/overview.md) · [Validation Report (`docs/validation/final_report.md`)](./docs/validation/final_report.md)

---

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Backend Microservice Architecture (`server/`)](#2-backend-microservice-architecture-server)
3. [Database Schema & Spatial Storage Architecture (PostGIS + MinIO)](#3-database-schema--spatial-storage-architecture-postgis--minio)
4. [Asynchronous Job Queue & WebSocket Telemetry](#4-asynchronous-job-queue--websocket-telemetry)
5. [Low-Level Binary GIS Exporter (`server/internal/gisexport/`)](#5-low-level-binary-gis-exporter-serverinternalgisexport)
6. [Frontend Client Architecture (`frontend/`)](#6-frontend-client-architecture-frontend)
7. [CesiumJS 3D WebGL Rendering Pipeline](#7-cesiumjs-3d-webgl-rendering-pipeline)
8. [Satellite Remote Sensing Pipeline (`engines/gee/`)](#8-satellite-remote-sensing-pipeline-enginesgee)
9. [DevOps, Containerization & Production Cloud Infrastructure](#9-devops-containerization--production-cloud-infrastructure)
10. [API Reference & Network Protocol Specification](#10-api-reference--network-protocol-specification)

---

## 1. System Architecture Overview

STRATA is architected as an asynchronous, event-driven, micro-service platform designed to ingest complex digital elevation models (DEMs), execute high-performance computational fluid dynamics (CFD) kernels, process multi-spectral satellite radar, and stream 3D digital twin states to web clients with sub-second latency.

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    FRONTEND CLIENT                     │
                               │        Next.js 16 · React 19 · TypeScript 5.4          │
                               │        CesiumJS 1.145 WebGL 3D Globe Container         │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                        HTTP/2 REST        │  WebSocket ws:// (Bi-directional)
                                        JSON & GeoJSON     │  Live Simulation Stream
                                                           │
                               ┌───────────────────────────▼────────────────────────────┐
                               │                 GO 1.24 BACKEND SERVER                 │
                               │        Chi Router v5 · Zerolog · Gorilla WebSocket     │
                               ├───────────────────────────┬────────────────────────────┤
                               │ Core Route Handlers       │ Internal Engines           │
                               │ • /api/cases              │ • Froehlich/USBR Hydrograph│
                               │ • /api/scenarios          │ • Asynchronous Worker Pool │
                               │ • /api/simulations        │ • Binary GIS Shapefile Gen │
                               │ • /api/tiles              │ • Section 31 EAP Report Gen│
                               │ • /api/observation        │ • PostGIS Spatial Client   │
                               └─────────────┬─────────────┴──────────────┬─────────────┘
                                             │                            │
                     SQL Spatial Queries     │                            │  S3 API
                     (ST_Intersects, GIST)   │                            │  Get/Put Objects
                                             │                            │
             ┌───────────────────────────────▼────────┐  ┌────────────────▼────────────────┐
             │       POSTGRESQL 16 + POSTGIS          │  │     MINIO S3 OBJECT STORAGE     │
             │   14 Relational Tables · GIST Indexes  │  │  DEM GeoTIFFs · Terrain-RGB     │
             │   Settlements · Dams · Exposure Vectors│  │  Hillshade Tiles · Sim Rasters  │
             └────────────────────────────────────────┘  └─────────────────────────────────┘
                                 ▲                                        ▲
                                 │ Inter-process execution / Pipe         │ Storage Write
                                 │                                        │
             ┌───────────────────┴────────────────────────────────────────┴────────────────┐
             │                          COMPUTATION ENGINES (Python)                       │
             │  • 2D SWE Finite Volume Kernel (HLL Riemann + Audusse Bed Slope)            │
             │  • Gómez-Gesteira DualSPHysics 3D Particle Flume Dataset Adapter            │
             │  • Google Earth Engine (GEE) Sentinel-1 C-SAR & Sentinel-2 NDSI Pipeline    │
             └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Microservice Architecture (`server/`)

The STRATA backend is engineered in **Go 1.24** to achieve maximum concurrency, zero garbage-collection pauses during raster streaming, and minimal memory footprint.

### 2.1 Chi Middleware Pipeline
The HTTP pipeline in [`server/main.go`](file:///c:/Users/adity/OneDrive/SIH26161/server/main.go) is constructed using a zero-allocation middleware chain:
- `middleware.RequestID`: Injects a unique UUID into the request context for end-to-end tracing.
- `middleware.RealIP`: Resolves client IP across cloud load balancers (Render/Cloudflare/AWS).
- `logger.StructuredLogger`: Fast JSON structured logging using `rs/zerolog`.
- `middleware.Recoverer`: Catches unhandled panics and returns HTTP 500 JSON without terminating the server.
- `cors.Handler`: Configured via environment variables (`API_CORS_ORIGIN`) with permissive fallback (`*`) to ensure cross-origin safety between Vercel and Render.

### 2.2 Route Handlers (`server/handlers/`)
All route handlers follow a clean dependency-injection pattern receiving pointers to the PostGIS connection pool, MinIO client, and WebSocket hub:

| Handler File | Endpoints | Architectural Responsibility |
| :--- | :--- | :--- |
| [`cases.go`]| `GET /api/cases`<br />`GET /api/cases/{id}` | Fetches registered benchmark dams (Tehri, Sardar Sarovar, Bhakra, Idukki, Rishi Ganga), reservoir parameters, downstream reach vectors, and bounding boxes. |
| [`scenarios.go`]| `GET /api/scenarios`<br />`POST /api/scenarios` | Validates breach triggers (piping vs overtopping), computes Froehlich/USBR breach parameters, and persists scenario records. |
| [`simulations.go`]| `POST /api/simulations`<br />`GET /api/simulations/{id}` | Enqueues simulation jobs to the asynchronous background worker, tracks execution status (`queued`, `running`, `completed`, `failed`). |
| [`tiles.go`]| `GET /api/tiles/{z}/{x}/{y}.pbf`<br />`GET /api/tiles/terrain-rgb/{z}/{x}/{y}.png` | Serves dynamic Mapbox Vector Tiles (MVT) generated directly from PostGIS using `ST_AsMVT` and streams pre-cached Mapbox Terrain-RGB elevation tiles. |
| [`datasets.go`]| `GET /api/datasets`<br />`GET /api/datasets/{id}/manifest` | Catalogs raw Copernicus 30m DEMs, river cross-sections, and Manning roughness spatial layers. |
| [`observation.go`]| `GET /api/observations/satellite`<br />`POST /api/observations/trigger` | Interfaces with Google Earth Engine telemetry outputs for Sentinel-1 C-SAR flood polygons and Sentinel-2 optical scarp anomalies. |
| [`impact.go`]| `GET /api/impact/{simulation_id}` | Computes spatial intersection between maximum flood extent polygons and downstream settlements/structures to calculate population at risk. |
| [`comparison.go`]| `GET /api/comparison/{case_id}` | Returns normalized cross-solver performance metrics (2D SWE vs 3D SPH vs Sentinel-1 C-SAR). |
| [`exports.go`]| `GET /api/exports/{sim_id}/shapefile`<br />`GET /api/exports/{sim_id}/eap-report` | Streams on-the-fly generated ESRI Shapefile ZIP archives and formatted statutory EAP Markdown/PD| `GET /api/health`<br />`GET /api/health/db` | Microservice liveness and deep database connection health probes. |

---

## 3. Database Schema & Spatial Storage Architecture (PostGIS + MinIO)

### 3.1 PostgreSQL + PostGIS Schema Design
STRATA utilizes PostgreSQL 16 with the **PostGIS 3.4** extension to perform sub-millisecond geometric calculations in Native EPSG:4326 (WGS 84) and EPSG:32644 (UTM Zone 44N).

#### Core Entity-Relationship Layout:
```sql
-- 1. Benchmark Case Studies
CREATE TABLE cases (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    river VARCHAR(255) NOT NULL,
    bbox GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Large Dam Engineering Registry
CREATE TABLE dams (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) REFERENCES cases(id),
    name VARCHAR(255) NOT NULL,
    structure_type VARCHAR(64) NOT NULL, -- Rockfill, Gravity, Arch
    height_m NUMERIC(8,2) NOT NULL,
    crest_length_m NUMERIC(8,2) NOT NULL,
    storage_capacity_mcm NUMERIC(12,2) NOT NULL,
    spillway_capacity_cumec NUMERIC(10,2) NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL
);

-- 3. Downstream Settlements & Rural Exposure (Google Open Buildings Ingestion)
CREATE TABLE settlements (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(64) REFERENCES cases(id),
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(64) NOT NULL, -- Town, Village, Hamlet, Building Cluster
    population INTEGER DEFAULT 0,
    elevation_m NUMERIC(8,2),
    chainage_km NUMERIC(8,2),
    geom GEOMETRY(Point, 4326) NOT NULL
);

-- Spatial GIST Index for Rapid Intersect Operations
CREATE INDEX idx_settlements_geom ON settlements USING GIST (geom);
CREATE INDEX idx_cases_bbox ON cases USING GIST (bbox);
```

### 3.2 MinIO S3 Object Storage Layout
Large raster files, satellite scenes, and elevation tiles are stored in an S3-compatible MinIO object store to keep the database lightweight:

```
s3://strata-data/
├── dems/
│   ├── tehri_cop30.tif               # Raw 24.6 MB Copernicus 30m GeoTIFF
│   └── rishi_ganga_cop30.tif         # Chamoli 30m high-relief terrain
├── tiles/
│   ├── terrain-rgb/{z}/{x}/{y}.png   # Red-Green-Blue encoded elevation tiles
│   └── hillshade/{z}/{x}/{y}.png     # Pre-rendered multidirectional hillshade
├── simulations/{simulation_id}/
│   ├── depth_max.tif                 # Peak water depth raster (float32)
│   ├── arrival_time.tif              # First wave arrival time in seconds
│   └── velocity_max.tif              # Peak flow velocity raster
└── satellite/
    ├── s1_sar_chamoli_diff.tif       # Sentinel-1 radar change detection
    └── s2_optical_ndsi.tif           # Sentinel-2 NDSI scarp collapse layer
```

#### Mapbox Terrain-RGB Height Encoding Formula:
Elevation in meters is recovered directly in client shaders using:
$$\text{Elevation (meters)} = -10000 + \left(R \times 256^2 + G \times 256 + B\right) \times 0.1$$

---

## 4. Asynchronous Job Queue & WebSocket Telemetry

Hydrodynamic simulations can run anywhere from 5 seconds (analytical calibration) to several minutes (full 2D SWE mesh). To prevent blocking HTTP connections:

1. **Non-Blocking Dispatch:** `POST /api/simulations` persists the job record with status `queued` and pushes a job descriptor onto an internal buffered Go channel (`worker.JobQueue`).
2. **Dedicated Worker Goroutines:** A pool of background workers pulls jobs from the channel, executes the Python solver kernel (`engines/delft3d/runner.py`) via `os/exec.Command`, and captures real-time stdout progress.
3. **WebSocket Event Broadcasting:** The worker parses progress strings (`[PROGRESS] 45% - t=1200s`) and broadcasts JSON payloads to all connected WebSocket clients subscribed to the simulation channel via `server/ws/hub.go`.

```json
{
  "type": "SIMULATION_PROGRESS",
  "simulation_id": "sim-tehri-piping-001",
  "progress_pct": 68,
  "elapsed_s": 2450.0,
  "current_surge_km": 42.5,
  "active_particles": 8450
}
```

---

## 5. Low-Level Binary GIS Exporter (`server/internal/gisexport/`)

Emergency responders and GIS analysts require standards-compliant ESRI Shapefiles for deployment into ArcGIS, QGIS, or government tactical displays. 

Rather than relying on bloated external dependencies (like GDAL C++ bindings), STRATA implements a **custom binary Shapefile compiler in pure Go** (`server/internal/gisexport/`):

1. **Strict Clockwise Ring Winding (Shoelace Formula):**
   Under ESRI Shapefile specifications, outer polygon rings **must** be wound clockwise, while interior holes must be wound counter-clockwise:
   $$\text{Signed Area} = \frac{1}{2} \sum_{i=0}^{n-1} \left(x_i y_{i+1} - x_{i+1} y_i\right)$$
   If the signed area is negative, STRATA's exporter automatically reverses the vertex array prior to binary serialization.

2. **16-bit Word Offset Architecture (`.shx` Index Header):**
   The `.shx` file provides spatial index lookup. STRATA strictly calculates offsets in **16-bit words (2 bytes)**:
   $$\text{File Length in Words} = 50 + 4 \times N_{\text{records}}$$
   Each record entry contains a 4-byte offset and a 4-byte content length, matching the ESRI technical specification to the exact byte.

3. **DBF Attribute Encoding:**
   Generates dBASE III `.dbf` tables storing structural parameters: `CASE_ID` (Char 32), `MAX_DEPTH` (Numeric 10.2), `PEAK_VEL` (Numeric 8.2), and `ARRIVAL_S` (Numeric 8.0).

---

## 6. Frontend Client Architecture (`frontend/`)

Built with **Next.js 16.3 (App Router)**, **React 19**, and **TypeScript 5.4**, the client provides a photorealistic 3D digital twin of India's river corridors.

### 6.1 App Router Architecture & Server/Client Segregation
- **Server Components:** Utilized for static landing pages (`app/page.tsx`), legal documentation, and operational guides (`app/guide/page.tsx`), achieving optimal Core Web Vitals and zero JavaScript payload.
- **Client Components (`'use client'`):** Reserved for dynamic map displays (`components/map/map-view.tsx`), WebGL canvas interaction, simulation configuration sliders, and WebSocket telemetry listeners.

### 6.2 Global Viewer Singleton & Persistent Context
Re-initializing a 3D WebGL globe on every page navigation causes noticeable memory leaks and screen flickering. STRATA implements a global persistent viewer instance (`persistentInstance` in `map-view.tsx`):
- When navigating away from `/map`, the Cesium canvas container is detached from the DOM but preserved in memory.
- When navigating back to `/map`, the existing WebGL context is re-attached instantly, eliminating 3–5 seconds of globe reload latency.

---

## 7. CesiumJS 3D WebGL Rendering Pipeline

### 7.1 Static Asset Isolation & Base URL
CesiumJS requires web workers, shaders, and terrain decoders. In Next.js, these are statically copied from `node_modules/cesium/Build/Cesium/` to `public/cesium/` via a `postinstall` script. 

During initialization:
```typescript
;(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = '/cesium'
const Cesium = await import('cesium')
```

### 7.2 Autonomous 3D Drone Flight Path
STRATA features an interactive **Drone Tour** that flies an orbital camera down the river canyon following the flood wave front:

```typescript
function computeBearing(p1: [number, number], p2: [number, number]): number {
  const lon1 = (p1[0] * Math.PI) / 180
  const lat1 = (p1[1] * Math.PI) / 180
  const lon2 = (p2[0] * Math.PI) / 180
  const lat2 = (p2[1] * Math.PI) / 180
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
```
The camera destination uses `Cesium.Cartesian3.fromDegrees(lng, lat, altitude)` with a dynamic pitch of $-32^\circ$ and sinusoidal easing, automatically cycling through downstream landmark waypoints (e.g., Tehri Dam $\to$ Koteshwar $\to$ Devprayag $\to$ Rishikesh $\to$ Haridwar).

---

## 8. Satellite Remote Sensing Pipeline (`engines/gee/`)

The remote sensing engine integrates directly with **Google Earth Engine (GEE)** using server-side service account authentication (`server/gee-credentials.json`):

### 8.1 Sentinel-1 Synthetic Aperture Radar (SAR) Pipeline
- **Collection:** `COPERNICUS/S1_GRD` (Interferometric Wide Swath, $10\text{m}$ pixel spacing).
- **Polarization:** Dual $VV + VH$.
- **Otsu Dynamic Thresholding:** Backscatter specular threshold set at $\sigma^0 \le -17.5\text{ dB}$ for open standing water.
- **Adaptive Gorge HAND Masking:** Standard SAR algorithms generate extensive false positives in mountain shadows. STRATA applies an **adaptive 55m gorge Height Above Nearest Drainage (HAND)** envelope: only radar anomalies situated within $55\text{m}$ vertical elevation of the validated river drainage network are classified as floodwater.

### 8.2 Sentinel-2 Optical Multi-Spectral Telemetry
- **Sensor:** Multi-Spectral Instrument (MSI) Level-2A.
- **NDSI Differencing:** Tracks snow and ice scarp collapse using:
  $$NDSI = \frac{\text{Band 3 (Green, 560nm)} - \text{Band 11 (SWIR, 1610nm)}}{\text{Band 3 (Green, 560nm)} + \text{Band 11 (SWIR, 1610nm)}}$$
- **Rishi Ganga Event Verification:** Applied to the February 7, 2021 Chamoli disaster, successfully isolating the catastrophic rock-ice avalanche detachment point ($\Delta NDSI = -0.42$).

---

## 9. DevOps, Containerization & Production Cloud Infrastructure

### 9.1 Multi-Container Docker Stack (`docker-compose.yml`)
For local development and on-premises disaster coordination centers, STRATA boots in seconds:
```bash
docker compose up -d postgres redis minio minio-init
```
- `postgres`: PostgreSQL 16 Alpine with PostGIS 3.4 enabled.
- `redis`: Redis 7 Alpine for high-throughput worker job queues.
- `minio`: High-performance S3-compatible object store.
- `minio-init`: Automates bucket provisioning (`strata-data`) and sets access policies.

### 9.2 Production Deployment Topology
- **Backend Service (Render Cloud):**
  - Compiled using a multi-stage Docker build (`golang:1.24-alpine` $\to$ `alpine:3.20`).
  - Memory footprint: $< 45\text{ MB}$ under idle; dynamically scales to $250\text{ MB}$ during active 2D SWE execution.
  - Automatic environment variable detection for `PORT`, `DATABASE_URL`, and `MINIO_ENDPOINT`.
- **Frontend Web Application (Vercel):**
  - Edge-optimized Next.js production build.
  - Zero-config static route prerendering for 14 static pages.
  - Global edge CDN distribution of static GeoJSON manifests and imagery assets.

---

## 10. API Reference & Network Protocol Specification

### Summary of REST Endpoints

```
GET  /api/health                     # Microservice health check (200 OK)
GET  /api/health/db                  # PostGIS database connectivity probe
GET  /api/cases                      # List all benchmark dam case studies
GET  /api/cases/{id}                 # Retrieve specific dam parameters & reach geometry
GET  /api/scenarios                  # List breach scenarios
POST /api/scenarios                  # Create a new dam breach scenario
POST /api/simulations                # Trigger a hydrodynamic simulation run
GET  /api/simulations/{id}           # Check simulation progress and raster URLs
GET  /api/tiles/terrain-rgb/{z}/{x}/{y}.png # Stream Mapbox Terrain-RGB elevation tiles
GET  /api/tiles/{z}/{x}/{y}.pbf      # Stream dynamic Mapbox Vector Tiles (MVT)
GET  /api/observations/satellite     # Fetch Sentinel-1 and Sentinel-2 satellite telemetry
GET  /api/impact/{simulation_id}     # Query exposed settlements and infrastructure
GET  /api/comparison/{case_id}       # Cross-solver comparison benchmarks
GET  /api/exports/{id}/shapefile     # Download zipped binary ESRI Shapefile
GET  /api/exports/{id}/eap-report    # Download Section 31 statutory EAP Markdown/PDF
GET  /api/ws                         # Upgrade HTTP connection to WebSocket telemetry
```

---

<p align="center">
  <em>STRATA Architecture Manual · Built by Team Goodfella for SIH 2026</em>
</p>
