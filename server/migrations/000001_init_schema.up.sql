-- Enable PostGIS extension for spatial data operations
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Cases (Study Areas e.g., Tehri Dam, Hirakud Dam)
CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    state VARCHAR(100),
    basin VARCHAR(100),
    bbox GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_bbox ON cases USING GIST (bbox);

-- 2. Dams Metadata and Geometry
CREATE TABLE IF NOT EXISTS dams (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    dam_type VARCHAR(100),
    height_m NUMERIC(8, 2),
    crest_length_m NUMERIC(8, 2),
    gross_storage_mcm NUMERIC(10, 2),
    effective_storage_mcm NUMERIC(10, 2),
    full_reservoir_level_m NUMERIC(8, 2),
    max_water_level_m NUMERIC(8, 2),
    crest_elevation_m NUMERIC(8, 2),
    spillway_type VARCHAR(100),
    spillway_capacity_cumec NUMERIC(10, 2),
    year_completed INT,
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dams_case_id ON dams(case_id);
CREATE INDEX IF NOT EXISTS idx_dams_geom ON dams USING GIST (geom);

-- 3. Rivers Network
CREATE TABLE IF NOT EXISTS rivers (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    reach_length_km NUMERIC(8, 2),
    centreline GEOMETRY(MultiLineString, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rivers_case_id ON rivers(case_id);
CREATE INDEX IF NOT EXISTS idx_rivers_centreline ON rivers USING GIST (centreline);

-- 4. DEM Metadata (Digital Elevation Models)
CREATE TABLE IF NOT EXISTS dem_metadata (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    resolution_m NUMERIC(6, 2) NOT NULL,
    crs VARCHAR(50) NOT NULL,
    storage_path TEXT NOT NULL,
    checksum_sha256 VARCHAR(64),
    acquisition_date DATE,
    bbox GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dem_case_id ON dem_metadata(case_id);
CREATE INDEX IF NOT EXISTS idx_dem_bbox ON dem_metadata USING GIST (bbox);

-- 5. Dam-Break Scenarios
CREATE TABLE IF NOT EXISTS scenarios (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL, -- overtopping, piping, seismic, landslide
    breach_formation_time_hr NUMERIC(6, 2),
    final_breach_width_m NUMERIC(8, 2),
    final_breach_depth_m NUMERIC(8, 2),
    peak_discharge_cumec NUMERIC(10, 2),
    reservoir_level_at_failure_m NUMERIC(8, 2),
    inflow_hydrograph JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_case_id ON scenarios(case_id);

-- 6. Hydrodynamic Simulation Runs (Delft3D FM or DualSPHysics)
CREATE TABLE IF NOT EXISTS simulation_runs (
    id VARCHAR(64) PRIMARY KEY,
    scenario_id VARCHAR(64) NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    solver VARCHAR(50) NOT NULL, -- delft3d, sph
    status VARCHAR(50) NOT NULL DEFAULT 'queued', -- queued, running, completed, failed, cancelled
    progress_percent NUMERIC(5, 2) DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    metrics JSONB, -- runtime_seconds, max_depth, max_velocity, flooded_area_sqkm
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_runs_scenario_id ON simulation_runs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sim_runs_status ON simulation_runs(status);

-- 7. Result Spatial Layers (COG, VTK, GeoJSON, KML, SHP)
CREATE TABLE IF NOT EXISTS result_layers (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    layer_type VARCHAR(50) NOT NULL, -- max_depth, max_velocity, arrival_time, wse, hazard_map
    time_step_sec INT,
    format VARCHAR(50) NOT NULL, -- cog, vtk, geojson, shapefile, kml
    storage_path TEXT NOT NULL,
    bbox GEOMETRY(Polygon, 4326),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_result_layers_run_id ON result_layers(run_id);
CREATE INDEX IF NOT EXISTS idx_result_layers_bbox ON result_layers USING GIST (bbox);

-- 8. Impact & Exposure Results (Population, Buildings, Infrastructure)
CREATE TABLE IF NOT EXISTS impact_results (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- population, buildings, roads, critical_infra, agriculture
    summary JSONB NOT NULL,
    geom GEOMETRY(Geometry, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impact_results_run_id ON impact_results(run_id);
CREATE INDEX IF NOT EXISTS idx_impact_results_geom ON impact_results USING GIST (geom);

-- 9. Observation Sources (Sentinel-1, IMERG, etc.)
CREATE TABLE IF NOT EXISTS observation_sources (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    platform VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(50),
    resolution_m NUMERIC(6, 2),
    update_frequency_hours INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Observation Scenes (Satellite Passes)
CREATE TABLE IF NOT EXISTS observation_scenes (
    id VARCHAR(64) PRIMARY KEY,
    source_id VARCHAR(64) NOT NULL REFERENCES observation_sources(id) ON DELETE CASCADE,
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    acquisition_time TIMESTAMPTZ NOT NULL,
    cloud_cover_percent NUMERIC(5, 2),
    footprint GEOMETRY(Polygon, 4326),
    raw_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_scenes_case_id ON observation_scenes(case_id);
CREATE INDEX IF NOT EXISTS idx_obs_scenes_footprint ON observation_scenes USING GIST (footprint);

-- 11. Observation Products (Detected Inundation Polygons/Rasters)
CREATE TABLE IF NOT EXISTS observation_products (
    id VARCHAR(64) PRIMARY KEY,
    scene_id VARCHAR(64) NOT NULL REFERENCES observation_scenes(id) ON DELETE CASCADE,
    product_type VARCHAR(50) NOT NULL, -- flood_extent_raster, flood_extent_vector
    storage_path TEXT NOT NULL,
    inundated_area_sqkm NUMERIC(10, 3),
    geom GEOMETRY(MultiPolygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_products_scene_id ON observation_products(scene_id);
CREATE INDEX IF NOT EXISTS idx_obs_products_geom ON observation_products USING GIST (geom);

-- 12. Observation Ingestion Runs
CREATE TABLE IF NOT EXISTS observation_ingestion_runs (
    id VARCHAR(64) PRIMARY KEY,
    source_id VARCHAR(64) NOT NULL REFERENCES observation_sources(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    scenes_discovered INT DEFAULT 0,
    scenes_ingested INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Validation Runs (Delft3D vs SPH vs Satellite Observation)
CREATE TABLE IF NOT EXISTS validation_runs (
    id VARCHAR(64) PRIMARY KEY,
    delft3d_run_id VARCHAR(64) REFERENCES simulation_runs(id) ON DELETE SET NULL,
    sph_run_id VARCHAR(64) REFERENCES simulation_runs(id) ON DELETE SET NULL,
    observed_product_id VARCHAR(64) REFERENCES observation_products(id) ON DELETE SET NULL,
    iou_score NUMERIC(5, 4),
    f1_score NUMERIC(5, 4),
    precision_score NUMERIC(5, 4),
    recall_score NUMERIC(5, 4),
    cross_section_differences JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. ML Runs (Optional Foundation Model Inference)
CREATE TABLE IF NOT EXISTS ml_runs (
    id VARCHAR(64) PRIMARY KEY,
    scene_id VARCHAR(64) REFERENCES observation_scenes(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    output_storage_path TEXT,
    metrics JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
