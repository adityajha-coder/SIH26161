-- Settlements and Population Centers downstream of dams
CREATE TABLE IF NOT EXISTS settlements (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    population INT,
    elevation_m NUMERIC(8, 2),
    distance_from_dam_km NUMERIC(8, 2),
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_case_id ON settlements(case_id);
CREATE INDEX IF NOT EXISTS idx_settlements_geom ON settlements USING GIST (geom);
