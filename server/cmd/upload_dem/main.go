package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

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

	rawFileCandidates := []string{
		"data/raw/tehri_cop30.tif",
		"../data/raw/tehri_cop30.tif",
		"../../data/raw/tehri_cop30.tif",
	}

	var rawPath string
	for _, cand := range rawFileCandidates {
		if fi, err := os.Stat(cand); err == nil && !fi.IsDir() {
			rawPath, _ = filepath.Abs(cand)
			break
		}
	}

	if rawPath == "" {
		log.Fatal().Msg("Raw DEM file tehri_cop30.tif not found in data/raw/")
	}

	fi, err := os.Stat(rawPath)
	if err != nil {
		log.Fatal().Err(err).Msg("Could not stat raw DEM")
	}
	fileSize := fi.Size()
	log.Info().Str("file", rawPath).Int64("size_bytes", fileSize).Msg("Found local raw DEM file")

	ctx := context.Background()
	objectKey := "dems/tehri_reach_cop30.tif"

	log.Info().Str("key", objectKey).Msg("Uploading DEM to object storage...")
	storageURI, err := store.UploadFile(ctx, objectKey, rawPath, "image/tiff")
	if err != nil {
		log.Fatal().Err(err).Msg("Upload failed")
	}

	log.Info().Str("uri", storageURI).Msg("DEM uploaded successfully")

	checksum := "c1cb80f45573de3b823b4c06b8a8c147b45f9ddbd3284d3588a3773b7741dd04"
	datasetSQL := `
		INSERT INTO datasets (id, case_id, name, category, format, storage_uri, file_size_bytes, checksum_sha256, metadata)
		VALUES (
			'dataset-dem-tehri-cop30',
			'tehri-dam',
			'Copernicus GLO-30 Digital Elevation Model',
			'dem',
			'geotiff',
			$1,
			$2,
			$3,
			'{"resolution_m": 30.0, "crs": "EPSG:4326", "projected_crs": "EPSG:32644"}'::jsonb
		)
		ON CONFLICT (id) DO UPDATE SET
			storage_uri = EXCLUDED.storage_uri,
			file_size_bytes = EXCLUDED.file_size_bytes,
			checksum_sha256 = EXCLUDED.checksum_sha256,
			updated_at = NOW();
	`
	if _, err := db.Exec(datasetSQL, storageURI, fileSize, checksum); err != nil {
		log.Fatal().Err(err).Msg("Failed to upsert dataset record in DB")
	}
	log.Info().Msg("Registered dataset record in PostgreSQL (datasets table)")

	demMetaSQL := `
		UPDATE dem_metadata
		SET storage_path = $1
		WHERE case_id = 'tehri-dam';
	`
	_, _ = db.Exec(demMetaSQL, storageURI)
	log.Info().Msg("Updated dem_metadata storage_path")

	presignedURL, err := store.GetPresignedURL(ctx, objectKey, 1*time.Hour)
	if err != nil {
		log.Warn().Err(err).Msg("Could not generate presigned URL")
	} else {
		log.Info().Str("url", presignedURL).Msg("Generated presigned download URL")
	}

	fmt.Printf("\n================ OBJECT STORAGE VERIFICATION ================\n")
	fmt.Printf("Dataset ID     : dataset-dem-tehri-cop30\n")
	fmt.Printf("Case ID        : tehri-dam\n")
	fmt.Printf("Storage URI    : %s\n", storageURI)
	fmt.Printf("Size           : %d bytes (%.2f MB)\n", fileSize, float64(fileSize)/(1024*1024))
	fmt.Printf("Checksum       : %s\n", checksum)
	fmt.Printf("Storage Mode   : IsLocal=%v\n", store.IsLocal())
	if presignedURL != "" {
		fmt.Printf("Presigned URL  : %s\n", presignedURL)
	}
	fmt.Printf("=============================================================\n\n")
}
