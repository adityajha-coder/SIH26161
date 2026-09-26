-- Datasets Catalog Table (Raster and Vector assets linked to object storage)
CREATE TABLE IF NOT EXISTS datasets (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- dem, satellite, river, dam, exposure, population
    format VARCHAR(50) NOT NULL,   -- geotiff, cog, shapefile, geojson, netcdf
    storage_uri TEXT NOT NULL,     -- s3://sih26161/dems/tehri_reach_cop30.tif or file://...
    file_size_bytes BIGINT,
    checksum_sha256 VARCHAR(64),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datasets_case_id ON datasets(case_id);
CREATE INDEX IF NOT EXISTS idx_datasets_category ON datasets(category);
