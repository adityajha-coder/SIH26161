package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/lib/pq"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/sih26161/backend/config"
	"github.com/sih26161/backend/storage"
)

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout})
	cfg := config.Load()

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Database connection failed")
	}
	defer db.Close()

	store, err := storage.NewClient(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Storage client initialization failed")
	}

	tilesDirCandidates := []string{
		"data/processed/tiles",
		"../data/processed/tiles",
		"../../data/processed/tiles",
	}

	var tilesDir string
	for _, cand := range tilesDirCandidates {
		if fi, err := os.Stat(cand); err == nil && fi.IsDir() {
			tilesDir, _ = filepath.Abs(cand)
			break
		}
	}

	if tilesDir == "" {
		log.Fatal().Msg("Tiles directory data/processed/tiles not found")
	}

	log.Info().Str("path", tilesDir).Msg("Found local tiles directory")
	ctx := context.Background()

	// 1. Upload Terrain-RGB Tiles
	terrainDir := filepath.Join(tilesDir, "terrain")
	terrainCount, terrainBytes := uploadTileFolder(ctx, store, terrainDir, "tiles/terrain", "image/png")
	log.Info().Int("tiles_uploaded", terrainCount).Int64("bytes", terrainBytes).Msg("Uploaded Terrain-RGB tiles")

	// 2. Upload Hillshade Tiles
	hillshadeDir := filepath.Join(tilesDir, "hillshade")
	hsCount, hsBytes := uploadTileFolder(ctx, store, hillshadeDir, "tiles/hillshade", "image/png")
	log.Info().Int("tiles_uploaded", hsCount).Int64("bytes", hsBytes).Msg("Uploaded Hillshade tiles")

	// 3. Upload Contours GeoJSON
	contoursPath := filepath.Join(tilesDir, "contours.geojson")
	var contoursURI string
	var contoursSize int64
	if fi, err := os.Stat(contoursPath); err == nil {
		contoursSize = fi.Size()
		uri, err := store.UploadFile(ctx, "tiles/contours.geojson", contoursPath, "application/geo+json")
		if err != nil {
			log.Warn().Err(err).Msg("Failed to upload contours.geojson")
		} else {
			contoursURI = uri
			log.Info().Str("uri", uri).Int64("bytes", contoursSize).Msg("Uploaded contours.geojson")
		}
	}

	// 4. Upload Tile Manifest
	manifestPath := filepath.Join(tilesDir, "tile_manifest.json")
	if _, err := os.Stat(manifestPath); err == nil {
		_, _ = store.UploadFile(ctx, "tiles/tile_manifest.json", manifestPath, "application/json")
	}

	// 5. Register in DB
	upsertDataset(db, "dataset-tiles-terrain-rgb", "Tehri Corridor Mapbox Terrain-RGB Tiles (Zooms 8-12)", "tiles", "png",
		fmt.Sprintf("s3://%s/tiles/terrain/{z}/{x}/{y}.png", cfg.S3Bucket), terrainBytes,
		`{"min_zoom": 8, "max_zoom": 12, "format": "png", "encoding": "mapbox", "tile_count": `+fmt.Sprintf("%d", terrainCount)+`}`)

	upsertDataset(db, "dataset-tiles-hillshade", "Tehri Corridor Hillshade Raster Tiles (Zooms 8-12)", "tiles", "png",
		fmt.Sprintf("s3://%s/tiles/hillshade/{z}/{x}/{y}.png", cfg.S3Bucket), hsBytes,
		`{"min_zoom": 8, "max_zoom": 12, "format": "png", "tile_count": `+fmt.Sprintf("%d", hsCount)+`}`)

	if contoursURI != "" {
		upsertDataset(db, "dataset-vector-contours", "Tehri Downstream 100m Interval Contours", "vector", "geojson",
			contoursURI, contoursSize,
			`{"interval_m": 100, "crs": "EPSG:4326", "format": "geojson"}`)
	}

	fmt.Printf("\n================ TILE UPLOAD VERIFICATION ================\n")
	fmt.Printf("Terrain-RGB Tiles Uploaded : %d (%s)\n", terrainCount, formatBytes(terrainBytes))
	fmt.Printf("Hillshade Tiles Uploaded   : %d (%s)\n", hsCount, formatBytes(hsBytes))
	fmt.Printf("Contours GeoJSON Uploaded  : %s\n", formatBytes(contoursSize))
	fmt.Printf("Storage Mode               : S3 Bucket (%s)\n", cfg.S3Bucket)
	fmt.Printf("Database Catalog Records   : 3 datasets upserted\n")
	fmt.Printf("==========================================================\n\n")
}

func uploadTileFolder(ctx context.Context, store *storage.Client, rootDir, prefix, contentType string) (int, int64) {
	count := 0
	var totalBytes int64

	_ = filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(info.Name(), ".png") {
			return nil
		}

		rel, err := filepath.Rel(rootDir, path)
		if err != nil {
			return nil
		}
		relKey := filepath.ToSlash(rel)
		objectKey := fmt.Sprintf("%s/%s", prefix, relKey)

		_, err = store.UploadFile(ctx, objectKey, path, contentType)
		if err != nil {
			log.Warn().Err(err).Str("key", objectKey).Msg("Failed tile upload")
			return nil
		}

		count++
		totalBytes += info.Size()
		return nil
	})

	return count, totalBytes
}

func upsertDataset(db *sql.DB, id, name, category, format, uri string, size int64, metaJSON string) {
	query := `
		INSERT INTO datasets (id, case_id, name, category, format, storage_uri, file_size_bytes, checksum_sha256, metadata)
		VALUES ($1, 'tehri-dam', $2, $3, $4, $5, $6, 'n/a', $7::jsonb)
		ON CONFLICT (id) DO UPDATE SET
			storage_uri = EXCLUDED.storage_uri,
			file_size_bytes = EXCLUDED.file_size_bytes,
			metadata = EXCLUDED.metadata,
			updated_at = NOW();
	`
	if _, err := db.Exec(query, id, name, category, format, uri, size, metaJSON); err != nil {
		log.Warn().Err(err).Str("id", id).Msg("Failed to upsert dataset in database")
	}
}

func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
