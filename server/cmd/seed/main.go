package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/sih26161/backend/config"
)

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout})
	cfg := config.Load()

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Database connection failed")
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal().Err(err).Msg("Database unreachable")
	}

	tx, err := db.Begin()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to start transaction")
	}
	defer tx.Rollback()

	// 1. Seed Cases
	log.Info().Msg("Seeding cases...")
	casesSQL := `
		INSERT INTO cases (id, name, description, state, basin, bbox)
		VALUES
			(
				'tehri-dam',
				'Tehri Dam Inundation Study',
				'Primary benchmark case for dam-break hydrodynamic simulation along Bhagirathi-Ganga river corridor (105 km) to Haridwar plain.',
				'Uttarakhand',
				'Ganga Basin (Bhagirathi River)',
				ST_GeomFromText('POLYGON((78.10 29.85, 78.75 29.85, 78.75 30.55, 78.10 30.55, 78.10 29.85))', 4326)
			),
			(
				'rishiganga-blockage',
				'Rishiganga River Blockage (Chamoli 2021)',
				'Secondary validation case study for river blockage and glacial landslide surge.',
				'Uttarakhand',
				'Alaknanda Basin (Rishiganga - Dhauliganga)',
				ST_GeomFromText('POLYGON((79.60 30.40, 79.85 30.40, 79.85 30.60, 79.60 30.60, 79.60 30.40))', 4326)
			)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			state = EXCLUDED.state,
			basin = EXCLUDED.basin,
			bbox = EXCLUDED.bbox,
			updated_at = NOW();
	`
	if _, err := tx.Exec(casesSQL); err != nil {
		log.Fatal().Err(err).Msg("Failed to seed cases")
	}

	// 2. Seed Dams
	log.Info().Msg("Seeding dams...")
	damsSQL := `
		INSERT INTO dams (
			id, case_id, name, dam_type, height_m, crest_length_m,
			gross_storage_mcm, effective_storage_mcm, full_reservoir_level_m,
			max_water_level_m, crest_elevation_m, spillway_type,
			spillway_capacity_cumec, year_completed, geom
		)
		VALUES (
			'tehri-dam-structure',
			'tehri-dam',
			'Tehri Dam',
			'Earth and Rockfill',
			260.50,
			575.00,
			3540.00,
			2615.00,
			830.00,
			835.00,
			839.50,
			'Chute and Shaft Spillways',
			15300.00,
			2006,
			ST_SetSRID(ST_MakePoint(78.4808, 30.3781), 4326)
		)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			dam_type = EXCLUDED.dam_type,
			height_m = EXCLUDED.height_m,
			crest_length_m = EXCLUDED.crest_length_m,
			gross_storage_mcm = EXCLUDED.gross_storage_mcm,
			effective_storage_mcm = EXCLUDED.effective_storage_mcm,
			full_reservoir_level_m = EXCLUDED.full_reservoir_level_m,
			max_water_level_m = EXCLUDED.max_water_level_m,
			crest_elevation_m = EXCLUDED.crest_elevation_m,
			spillway_type = EXCLUDED.spillway_type,
			spillway_capacity_cumec = EXCLUDED.spillway_capacity_cumec,
			year_completed = EXCLUDED.year_completed,
			geom = EXCLUDED.geom,
			updated_at = NOW();
	`
	if _, err := tx.Exec(damsSQL); err != nil {
		log.Fatal().Err(err).Msg("Failed to seed dams")
	}

	// 3. Seed Rivers
	log.Info().Msg("Seeding rivers...")
	riversSQL := `
		INSERT INTO rivers (id, case_id, name, reach_length_km, centreline)
		VALUES (
			'bhagirathi-ganga-reach',
			'tehri-dam',
			'Bhagirathi - Ganga River Reach',
			105.00,
			ST_GeomFromText('MULTILINESTRING((78.4808 30.3781, 78.4950 30.3100, 78.5989 30.1458, 78.4500 30.1000, 78.2676 30.0869, 78.1642 29.9457))', 4326)
		)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			reach_length_km = EXCLUDED.reach_length_km,
			centreline = EXCLUDED.centreline;
	`
	if _, err := tx.Exec(riversSQL); err != nil {
		log.Fatal().Err(err).Msg("Failed to seed rivers")
	}

	// 4. Seed DEM Metadata
	log.Info().Msg("Seeding DEM metadata...")
	demSQL := `
		INSERT INTO dem_metadata (
			id, case_id, source, resolution_m, crs, storage_path, checksum_sha256, acquisition_date, bbox
		)
		VALUES (
			'dem-tehri-cop30',
			'tehri-dam',
			'Copernicus GLO-30',
			30.0,
			'EPSG:4326',
			'data/raw/tehri_cop30.tif',
			'c1cb80f45573de3b823b4c06b8a8c147b45f9ddbd3284d3588a3773b7741dd04',
			'2021-01-01',
			ST_GeomFromText('POLYGON((78.10 29.85, 78.75 29.85, 78.75 30.55, 78.10 30.55, 78.10 29.85))', 4326)
		)
		ON CONFLICT (id) DO UPDATE SET
			source = EXCLUDED.source,
			resolution_m = EXCLUDED.resolution_m,
			crs = EXCLUDED.crs,
			storage_path = EXCLUDED.storage_path,
			checksum_sha256 = EXCLUDED.checksum_sha256,
			acquisition_date = EXCLUDED.acquisition_date,
			bbox = EXCLUDED.bbox;
	`
	if _, err := tx.Exec(demSQL); err != nil {
		log.Fatal().Err(err).Msg("Failed to seed dem_metadata")
	}

	// 5. Seed Settlements
	log.Info().Msg("Seeding settlements...")
	settlementsSQL := `
		INSERT INTO settlements (id, case_id, name, population, elevation_m, distance_from_dam_km, geom)
		VALUES
			('settlement-tehri', 'tehri-dam', 'New Tehri Town', 25400, 1550.00, 5.20, ST_SetSRID(ST_MakePoint(78.4800, 30.3900), 4326)),
			('settlement-devprayag', 'tehri-dam', 'Devprayag', 7200, 472.00, 42.00, ST_SetSRID(ST_MakePoint(78.5989, 30.1458), 4326)),
			('settlement-rishikesh', 'tehri-dam', 'Rishikesh', 102500, 372.00, 85.00, ST_SetSRID(ST_MakePoint(78.2676, 30.0869), 4326)),
			('settlement-haridwar', 'tehri-dam', 'Haridwar', 228800, 314.00, 105.00, ST_SetSRID(ST_MakePoint(78.1642, 29.9457), 4326))
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			population = EXCLUDED.population,
			elevation_m = EXCLUDED.elevation_m,
			distance_from_dam_km = EXCLUDED.distance_from_dam_km,
			geom = EXCLUDED.geom;
	`
	if _, err := tx.Exec(settlementsSQL); err != nil {
		log.Fatal().Err(err).Msg("Failed to seed settlements")
	}

	// 6. Seed Baseline Scenario
	log.Info().Msg("Seeding baseline scenario...")
	scenariosSQL := `
		INSERT INTO scenarios (
			id, case_id, name, description, trigger_type,
			breach_formation_time_hr, final_breach_width_m, final_breach_depth_m,
			peak_discharge_cumec, reservoir_level_at_failure_m
		)
		VALUES (
			'tehri-pmf-overtopping',
			'tehri-dam',
			'Probable Maximum Flood (PMF) Overtopping Breach',
			'Baseline dam breach scenario triggered by extreme hydrological inflow exceeding spillway design capacity (Froehlich / MacDonald-Langridge breach formulation).',
			'overtopping',
			2.50,
			180.00,
			120.00,
			65000.00,
			835.00
		)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			trigger_type = EXCLUDED.trigger_type,
			breach_formation_time_hr = EXCLUDED.breach_formation_time_hr,
			final_breach_width_m = EXCLUDED.final_breach_width_m,
			final_breach_depth_m = EXCLUDED.final_breach_depth_m,
			peak_discharge_cumec = EXCLUDED.peak_discharge_cumec,
			reservoir_level_at_failure_m = EXCLUDED.reservoir_level_at_failure_m;
	`
	if _, err := tx.Exec(scenariosSQL); err != nil {
		log.Fatal().Err(err).Msg("Failed to seed scenarios")
	}

	if err := tx.Commit(); err != nil {
		log.Fatal().Err(err).Msg("Failed to commit seed transaction")
	}

	log.Info().Msg("Database seeded successfully with primary case study data!")
	fmt.Println("\nSeed completed successfully.")

	verify(db)
}

func verify(db *sql.DB) {
	fmt.Println("\n================ VERIFICATION: PRIMARY CASE STUDY ================")

	// 1. Verify Cases
	fmt.Println("\n[1] CASES (SELECT id, name, state, ST_AsText(bbox) FROM cases):")
	rows, err := db.Query("SELECT id, name, state, ST_AsText(bbox) FROM cases ORDER BY id")
	if err != nil {
		log.Fatal().Err(err).Msg("Query cases failed")
	}
	defer rows.Close()
	for rows.Next() {
		var id, name, state, bbox string
		_ = rows.Scan(&id, &name, &state, &bbox)
		fmt.Printf("  • ID: %s | Name: %s | State: %s\n    BBox: %s\n", id, name, state, bbox)
	}

	// 2. Verify Dams
	fmt.Println("\n[2] DAMS (SELECT id, name, dam_type, height_m, gross_storage_mcm, ST_AsText(geom) FROM dams WHERE case_id = 'tehri-dam'):")
	damRows, err := db.Query("SELECT id, name, dam_type, height_m, gross_storage_mcm, ST_AsText(geom) FROM dams WHERE case_id = 'tehri-dam'")
	if err != nil {
		log.Fatal().Err(err).Msg("Query dams failed")
	}
	defer damRows.Close()
	for damRows.Next() {
		var id, name, damType, geom string
		var height, storage float64
		_ = damRows.Scan(&id, &name, &damType, &height, &storage, &geom)
		fmt.Printf("  • ID: %s | Name: %s | Type: %s | Height: %.2fm | Storage: %.2f MCM\n    Location: %s\n", id, name, damType, height, storage, geom)
	}

	// 3. Verify Rivers
	fmt.Println("\n[3] RIVERS (SELECT id, name, reach_length_km, ST_AsText(centreline) FROM rivers WHERE case_id = 'tehri-dam'):")
	riverRows, err := db.Query("SELECT id, name, reach_length_km, ST_AsText(centreline) FROM rivers WHERE case_id = 'tehri-dam'")
	if err != nil {
		log.Fatal().Err(err).Msg("Query rivers failed")
	}
	defer riverRows.Close()
	for riverRows.Next() {
		var id, name, centreline string
		var length float64
		_ = riverRows.Scan(&id, &name, &length, &centreline)
		fmt.Printf("  • ID: %s | Name: %s | Reach: %.2f km\n    Centreline: %s\n", id, name, length, centreline)
	}

	// 4. Verify Settlements
	fmt.Println("\n[4] SETTLEMENTS (SELECT id, name, population, distance_from_dam_km, ST_AsText(geom) FROM settlements WHERE case_id = 'tehri-dam'):")
	settleRows, err := db.Query("SELECT id, name, population, distance_from_dam_km, ST_AsText(geom) FROM settlements WHERE case_id = 'tehri-dam' ORDER BY distance_from_dam_km")
	if err != nil {
		log.Fatal().Err(err).Msg("Query settlements failed")
	}
	defer settleRows.Close()
	for settleRows.Next() {
		var id, name, geom string
		var pop int
		var dist float64
		_ = settleRows.Scan(&id, &name, &pop, &dist, &geom)
		fmt.Printf("  • %-16s | Pop: %-7d | Dist: %6.2f km | Location: %s\n", name, pop, dist, geom)
	}

	// 5. Verify DEM Metadata
	fmt.Println("\n[5] DEM METADATA (SELECT id, source, resolution_m, crs, storage_path, checksum_sha256 FROM dem_metadata WHERE case_id = 'tehri-dam'):")
	demRows, err := db.Query("SELECT id, source, resolution_m, crs, storage_path, checksum_sha256 FROM dem_metadata WHERE case_id = 'tehri-dam'")
	if err != nil {
		log.Fatal().Err(err).Msg("Query dem_metadata failed")
	}
	defer demRows.Close()
	for demRows.Next() {
		var id, source, crs, storage, checksum string
		var res float64
		_ = demRows.Scan(&id, &source, &res, &crs, &storage, &checksum)
		fmt.Printf("  • ID: %s | Source: %s | Res: %.1fm | CRS: %s\n    Path: %s\n    SHA256: %s\n", id, source, res, crs, storage, checksum)
	}

	// 6. Verify Scenarios
	fmt.Println("\n[6] SCENARIOS (SELECT id, name, trigger_type, peak_discharge_cumec FROM scenarios WHERE case_id = 'tehri-dam'):")
	scenRows, err := db.Query("SELECT id, name, trigger_type, peak_discharge_cumec FROM scenarios WHERE case_id = 'tehri-dam'")
	if err != nil {
		log.Fatal().Err(err).Msg("Query scenarios failed")
	}
	defer scenRows.Close()
	for scenRows.Next() {
		var id, name, trigger string
		var peak float64
		_ = scenRows.Scan(&id, &name, &trigger, &peak)
		fmt.Printf("  • ID: %s | Name: %s | Trigger: %s | Peak Q: %.2f cumec\n", id, name, trigger, peak)
	}

	fmt.Printf("\n===================================================================\n\n")
}
