# JALREKHA: Dam Break and River Inundation Intelligence System

## Executive Summary

JALREKHA is an enterprise grade hydrodynamic modeling, flood propagation simulation, and disaster response intelligence platform built for problem statement SIH26161. The system models catastrophic flood waves originating from dam failures, glacial lake outburst floods, and landslide dam formations in major Indian river catchments.

The primary operational case study encompasses the Tehri Dam complex on the Bhagirathi River in Uttarakhand, tracking hydrodynamic flood wave propagation over a 129 kilometer continuous river reach through Koteshwar, Devprayag, Rishikesh, and Haridwar. The platform also models historical flash flood crises, including the 2021 Rishi Ganga disaster, overtopping failures, and controlled emergency spillway discharges.

The solution integrates a dual simulation solver framework, an asynchronous Go backend engine, a modern three dimensional CesiumJS geospatial visualization interface, automated Earth Observation telemetry, and Humanitarian Assistance and Disaster Relief evacuation analytics.

## Problem Statement Context

In mountainous Himalayan terrains and major river basins across India, natural dam formations, moraine dammed glacial lakes, and infrastructure failures present catastrophic downstream risks. Historical incidents include:

1. The February 2021 Rishi Ganga flash flood caused by rock and ice avalanche blockage.
2. The November 2021 Wapriyang river obstruction.
3. The March 2015 Phuktal river landslide dam in Jammu and Kashmir.
4. The 2008 Kosi river breach and embankment failure.
5. Severe valley flooding in Kashmir and Assam across multiple seasons.

When a dam or landslide barrier fails, millions of cubic meters of impounded water discharge into narrow river gorges within minutes. Establishing precise estimates of breach peak outflow, downstream wave arrival times, peak flood depths, velocity fields, and settlement impact zones is paramount for humanitarian evacuation and disaster mitigation.

## System Architecture

The project is structured as a modular monorepo comprising five dedicated layers:

1. Hydrodynamic Solvers: High performance physics engines modeling both near field turbulent plunge pool dynamics and regional downstream flood routing.
2. Core Go Application Server: High throughput RESTful application programming interface and WebSocket streaming server handling simulation orchestration, geospatial exports, and data persistence.
3. Spatial Database and Object Storage: PostgreSQL extended with PostGIS for spatial queries alongside Amazon Simple Storage Service compatible storage for multi gigabyte raster and vector datasets.
4. Three Dimensional Web Client: Next.js application leveraging React and CesiumJS for client side hardware accelerated digital elevation rendering, dynamic wavefront animation, and scenario configuration.
5. Satellite Telemetry Ingestion: Standalone Earth Observation monitoring scripts extracting Sentinel radar and optical reflectance products through Google Earth Engine.

## Dual Solver Simulation Framework

JALREKHA abandons single solver approximations in favor of a specialized dual engine approach:

### 1. Delft3D Flexible Mesh Regional Hydrodynamic Engine

• Governed by two dimensional depth averaged shallow water equations derived from the Navier Stokes equations.
• Solves mass conservation and momentum conservation across complex valley bathymetry and meandering floodplains.
• Operates over a 129 kilometer reach from the Tehri Dam toe to the Bhimgoda Barrage in Haridwar.
• Incorporates spatially varying Manning roughness coefficients, dynamic wetting and drying algorithms, and boundary conditions driven by calculated breach outflow hydrographs.
• Computes time series matrices of water elevation, depth, flow velocity, and arrival isochrones at high spatial resolution.

### 2. DualSPHysics Near Field Smoothed Particle Hydrodynamics Engine

• Meshless Lagrangian particle solver designed to capture violent, three dimensional, highly non linear free surface flows.
• Employs the Wendland quintic kernel with a symplectic time integrator to resolve the immediate dam breach zone, reservoir water column collapse, and hydraulic plunge pool impacts.
• Accurately predicts dynamic impact pressures and wall shear stresses against downstream rock surfaces and critical infrastructure during the first critical minutes of failure.
• Interpolates discrete particle velocity fields into regular raster grids for cross validation against shallow water models.

## Breach Outflow Hydrograph Formulation

The platform calculates outflow hydrographs using established empirical dam safety equations, primarily the Froehlich breach formation models:

1. Breach Bottom Width: Computed from total reservoir storage volume and reservoir water depth above the breach invert.
2. Breach Development Time: Estimated from impounded water volume and total breach height to determine the rapid failure duration.
3. Breach Side Slopes: Parameterized based on dam construction type, including earthen embankments, rockfill structures, and concrete gravity sections.
4. Peak Discharge Calculation: Determines maximum outflow discharge in cubic meters per second.
5. Conservation of Mass Balance: Automatically integrates outflow over time and verifies total released volume against initial reservoir storage within strict mass balance tolerance limits.

## Back End Architecture and Services

The backend server is implemented in Go for performance, memory efficiency, and concurrency:

1. API Routing and Middleware: Built with the Chi router, providing structured logging, CORS handling, panic recovery, and authentication hooks.
2. Database Connectivity: Direct integration with PostgreSQL and PostGIS using pgx connection pooling for spatial indexing and rapid attribute queries.
3. Object Storage Client: Integrated with Supabase Storage and Amazon S3 compatible object stores for storing raw digital elevation models, processed tiles, and simulation output archives.
4. Job Worker and Task Queue: An asynchronous worker pipeline that validates scenario inputs, generates solver control files, monitors process execution, captures real time stdout logs, and updates progress percentages.
5. WebSocket Event Streaming: Full duplex WebSocket connections that broadcast simulation run state transitions, progress updates, and telemetry notifications directly to connected web clients.
6. Scenario Presets: Built in configurations for historical Indian disaster scenarios:
• Tehri Dam catastrophic overtopping event.
• Rishi Ganga 2021 debris blockage and rapid outburst flood.
• Controlled emergency spillway discharge at maximum design capacity.

## Front End and Three Dimensional Geospatial Engine

The client application is built with Next.js using the App Router, React, and CesiumJS:

1. Three Dimensional Digital Elevation Model: Visualizes high resolution terrain elevation derived from Copernicus GLO thirty meter and ALOS global digital surface models, with configurable vertical exaggeration.
2. Base Imagery Switcher: Allows seamless toggling between high resolution satellite imagery and dark basemap tiles optimized for disaster operations.
3. Dynamic Flood Wavefront Animation: Renders inundated spatial polygons clamped directly to three dimensional terrain surfaces. Fluid wavefront progression is driven by time slider controls that filter polygons by arrival time in real time without regenerating WebGL geometry.
4. Metric Color Ramping: Interactive color gradients for flood depth, flow velocity vectors, and wave arrival isochrones.
5. Settlement Cartographic Hierarchy: Multi tier level of detail filtering:
• Strategic regional hubs such as Haridwar, Rishikesh, Devprayag, Tehri, Srinagar, and Koteshwar are permanently labeled with high contrast badges visible from regional altitudes.
• Village markers and labels appear dynamically as the user zooms into local valleys.
• Isolated hamlets are suppressed at macro zoom levels, preventing visual clutter while remaining accessible upon ground level inspection.
6. Persistent Viewer Caching: Implements a warm in memory viewer cache that preserves the active WebGL canvas across route navigation, ensuring zero reload delays when switching between views.
7. Design System: Strict monochrome dark theme with a deep background palette, subtle borders, high contrast typography, and zero blue glow effects.

## Disaster Response and Evacuation Analytics

The platform translates hydrodynamic outputs into actionable Humanitarian Assistance and Disaster Relief metrics:

1. Golden Hour Evacuation Matrix: Calculates available evacuation lead time, peak arrival hour, and peak depth for every downstream school, hospital, medical center, and residential zone.
2. Infrastructure Exposure Scoring: Identifies critical transportation choke points, inundated bridges, submerged arterial highways, and healthcare facilities requiring emergency evacuation.
3. Impact Classification: Automatically groups affected populations into high risk zones, intermediate warning zones, and safe muster zones based on water depth and flow velocity thresholds.

## Earth Observation and Satellite Telemetry

The platform incorporates automated Earth Observation data pipelines:

1. Google Earth Engine Integration: Standalone monitoring scripts that query Sentinel one Synthetic Aperture Radar ground range detected collections and Sentinel two optical imagery.
2. SAR Flood Detection: Leverages dual polarization radar backscatter to delineate standing water through cloud cover and precipitation during extreme weather events.
3. Normalized Difference Water Index: Calculates automated optical water indices from green and near infrared bands.
4. Freshness and Telemetry Monitor: Tracks satellite sensor platform name, acquisition timestamp, data age in hours, and spatial resolution in meters to inform emergency responders of observational certainty.

## GIS Data Export Engine

The backend includes a dedicated spatial exporter generating industry standard geospatial products:

1. Binary ESRI Shapefile Package: Generates valid binary shape files comprising the main geometry file, index file, dBase table file, and spatial projection definition file with exact byte level bounding boxes and polygon records.
2. Google Earth KML and KMZ: Produces vector contour polygons and pinpoint placemarks ready for Google Earth desktop and mobile field reconnaissance.
3. GeoJSON Format: Standards compliant geographic vector boundaries enriched with hydraulic properties including depth, velocity, and arrival time.
4. Executive Summary Report: Generates comprehensive documentation summarizing scenario parameters, peak discharge, downstream travel time, and affected infrastructure tallies.

## Repository Structure

```
SIH26161/
├── .github/
│   └── workflows/
│       └── ci.yml               Continuous integration pipeline
├── data/
│   ├── fixtures/                Test datasets and spatial vectors
│   ├── manifests/               Hydrology and population metadata
│   └── processed/               Digital elevation model products
├── docs/
│   └── architecture/            System architecture documentation
├── engines/
│   ├── delft3d/                 Delft3D Flexible Mesh runner scripts
│   ├── gee/                     Google Earth Engine monitoring script
│   └── sph/                     DualSPHysics SPH configuration files
├── frontend/
│   ├── app/                     Next.js pages and layouts
│   ├── components/
│   │   ├── common/              Shared layout and stat panel components
│   │   ├── flood/               Charts, tables, and simulation viewers
│   │   ├── map/                 CesiumJS map viewer and legend modules
│   │   ├── shell/               Top navigation and sidebar shell
│   │   └── ui/                  Core user interface primitives
│   ├── lib/                     Geospatial helpers, store, and breach math
│   └── public/                  Static assets, GeoJSON data, and logo
├── packages/
│   └── contracts/               JSON schemas for scenarios and simulation runs
├── scripts/
│   └── gis/                     DEM preprocessing and raster tile generators
└── server/
    ├── cmd/                     Migration, seed, and data upload CLI tools
    ├── config/                  Environment configuration loaders
    ├── db/                      PostgreSQL connection management
    ├── handlers/                HTTP request handlers for all endpoints
    ├── internal/
    │   ├── breach/              Froehlich breach calculation routines
    │   ├── comparison/          Cross engine comparison metrics
    │   ├── gisexport/           Shapefile, KML, and GeoJSON exporters
    │   ├── impact/              Evacuation matrix and asset exposure logic
    │   ├── observation/         Satellite observation data structures
    │   └── worker/              Asynchronous simulation runner pipeline
    └── main.go                  Server entry point and routing table
```

## Local Development and Installation

### Prerequisites

1. Go compiler version 1.23 or newer.
2. Node.js runtime version 20 or newer.
3. Package manager pnpm version 9 or newer.
4. Python version 3.11 with rasterio and numpy packages installed.
5. Docker engine with Compose plugin for running PostgreSQL, PostGIS, Redis, and MinIO.

### Step 1: Clone Repository

```bash
git clone https://github.com/adityajha/SIH26161.git
cd SIH26161
```

### Step 2: Start Infrastructure Services

```bash
docker compose up
```

### Step 3: Configure Environment Variables

Create environment configuration files for both the Go backend and Next.js frontend:

In server root:
```env
PORT=8080
DATABASE_URL=postgres://postgres:postgres@localhost:5432/jalrekha?sslmode=disable
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_BUCKET=jalrekhavault
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_USE_SSL=false
```

In frontend root:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

### Step 4: Run Database Migrations

```bash
cd server
go run ./cmd/migrate up
```

### Step 5: Start the Backend Server

```bash
cd server
go run .
```

The Go server initiates on port 8080. Health checks can be verified at the health endpoint:

```bash
curl http://localhost:8080/api/health
```

### Step 6: Install Frontend Dependencies and Start Development Server

```bash
cd frontend
pnpm install
pnpm dev
```

During package installation, the post install script automatically copies Cesium static workers, widgets, third party libraries, and assets into the public directory. The application launches locally on port 3000.

## Verification and Testing

### Backend Unit Tests

Run the complete Go test suite:

```bash
cd server
go test ./...
```

Verifies breach equations, Froehlich calculations, mass balance checks, worker execution pipelines, spatial export generation, impact analytics, and handler endpoints.

### Frontend Type Checking and Production Build

Validate TypeScript types and build the production bundle:

```bash
cd frontend
pnpm exec tsc
pnpm build
```

Confirms zero type errors and validates that all application routes prerender successfully under the Next.js compiler.

### Python Script Compilation

Verify syntax across all calculation and Earth Observation scripts:

```bash
python engines/delft3d/runner.py
python engines/gee/gee_monitor.py
```

## Continuous Integration Pipeline

The repository includes an automated GitHub Actions pipeline defined in the workflows directory:

1. Backend Job: Sets up Go 1.23 with module caching, verifies module integrity, runs static code analysis with go vet, executes unit tests, and compiles server binaries.
2. Frontend Job: Sets up Node.js 20 and pnpm 9, installs dependencies with frozen lockfile validation, runs TypeScript type checks, and compiles the Next.js production build.
3. Scripts and Schemas Job: Sets up Python 3.11, compiles all engine scripts, and validates JSON schemas.
4. Concurrency Management: Automatically terminates redundant in progress runs when newer commits are pushed to the same branch.
