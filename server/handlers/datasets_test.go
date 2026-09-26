package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/sih26161/backend/config"
	"github.com/sih26161/backend/db"
	"github.com/sih26161/backend/storage"
)

func TestDatasetEndpoints(t *testing.T) {
	cfg := config.Load()
	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil || database.Ping(t.Context()) != nil {
		t.Skip("PostgreSQL not reachable, skipping integration test")
	}
	defer database.Close()

	store, err := storage.NewClient(cfg)
	if err != nil {
		t.Fatalf("Storage client creation failed: %v", err)
	}

	h := NewDatasetHandler(database.Conn, store)

	r := chi.NewRouter()
	r.Get("/api/v1/datasets", h.ListDatasets)
	r.Get("/api/v1/datasets/{id}", h.GetDataset)
	r.Get("/api/v1/datasets/{id}/download", h.DownloadDataset)

	// 1. Test List Datasets
	req := httptest.NewRequest("GET", "/api/v1/datasets", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("ListDatasets returned status %d, expected %d", rec.Code, http.StatusOK)
	}

	// 2. Test Get Specific Dataset
	req = httptest.NewRequest("GET", "/api/v1/datasets/dataset-dem-tehri-cop30", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("GetDataset returned status %d, expected %d", rec.Code, http.StatusOK)
	}

	// 3. Test Download DEM via API
	req = httptest.NewRequest("GET", "/api/v1/datasets/dataset-dem-tehri-cop30/download", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("DownloadDataset returned status %d, expected %d", rec.Code, http.StatusOK)
	}

	body := rec.Body.Bytes()
	if len(body) < 16 {
		t.Fatalf("Downloaded body too small: %d bytes", len(body))
	}

	// Verify valid TIFF header (Little-endian 'II*\x00' or big-endian 'MM\x00*')
	if !bytes.Equal(body[:4], []byte{0x49, 0x49, 0x2A, 0x00}) && !bytes.Equal(body[:4], []byte{0x4D, 0x4D, 0x00, 0x2A}) {
		t.Fatalf("Invalid TIFF header from downloaded DEM: %x", body[:4])
	}

	t.Logf("Successfully downloaded DEM via API: %d bytes with valid TIFF header", len(body))
}
