package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestTileHandler(t *testing.T) {
	h := NewTileHandler(nil)
	h.projectRoot = t.TempDir()

	writeTestTile := func(t *testing.T, tileType string) {
		t.Helper()
		dir := filepath.Join(h.projectRoot, "data", "processed", "tiles", tileType, "10", "735")
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("Failed to create tile directory: %v", err)
		}
		png := append([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, []byte("test-tile")...)
		if err := os.WriteFile(filepath.Join(dir, "422.png"), png, 0o644); err != nil {
			t.Fatalf("Failed to write test tile: %v", err)
		}
	}

	writeTestTile(t, "terrain")
	writeTestTile(t, "hillshade")

	contoursPath := filepath.Join(h.projectRoot, "data", "processed", "tiles", "contours.geojson")
	if err := os.MkdirAll(filepath.Dir(contoursPath), 0o755); err != nil {
		t.Fatalf("Failed to create contours directory: %v", err)
	}
	contoursPayload := `{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"elev":"`
	contoursPayload += strings.Repeat("1200", 400)
	contoursPayload += `"},"geometry":{"type":"LineString","coordinates":[[78.1,30.2],[78.2,30.3]]}}]}`
	if err := os.WriteFile(contoursPath, []byte(contoursPayload), 0o644); err != nil {
		t.Fatalf("Failed to write contours fixture: %v", err)
	}

	t.Run("ServeTerrainTile", func(t *testing.T) {
		r := chi.NewRouter()
		r.Get("/tiles/terrain/{z}/{x}/{y}", h.ServeTerrainTile)

		req, err := http.NewRequest("GET", "/tiles/terrain/10/735/422.png", nil)
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}

		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("Expected HTTP 200, got %d. Body: %s", rr.Code, rr.Body.String())
		}

		if ct := rr.Header().Get("Content-Type"); ct != "image/png" {
			t.Errorf("Expected Content-Type image/png, got %s", ct)
		}

		// Verify PNG signature: 89 50 4E 47 0D 0A 1A 0A
		pngMagic := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
		if !bytes.HasPrefix(rr.Body.Bytes(), pngMagic) {
			t.Errorf("Body does not start with valid PNG magic bytes")
		}
	})

	t.Run("ServeHillshadeTile", func(t *testing.T) {
		r := chi.NewRouter()
		r.Get("/tiles/hillshade/{z}/{x}/{y}", h.ServeHillshadeTile)

		req, err := http.NewRequest("GET", "/tiles/hillshade/10/735/422.png", nil)
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}

		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("Expected HTTP 200, got %d. Body: %s", rr.Code, rr.Body.String())
		}

		if ct := rr.Header().Get("Content-Type"); ct != "image/png" {
			t.Errorf("Expected Content-Type image/png, got %s", ct)
		}
	})

	t.Run("ServeContours", func(t *testing.T) {
		req, err := http.NewRequestWithContext(context.Background(), "GET", "/tiles/contours.geojson", nil)
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}

		rr := httptest.NewRecorder()
		h.ServeContours(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("Expected HTTP 200, got %d", rr.Code)
		}

		if ct := rr.Header().Get("Content-Type"); ct != "application/geo+json" {
			t.Errorf("Expected Content-Type application/geo+json, got %s", ct)
		}

		if rr.Body.Len() < 1000 {
			t.Errorf("Expected large GeoJSON response, got %d bytes", rr.Body.Len())
		}
	})
}
