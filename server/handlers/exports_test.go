package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/sih26161/backend/internal/reportgen"
)

func TestExportReport(t *testing.T) {
	h := NewExportHandler()

	r := chi.NewRouter()
	r.Get("/exports/{runId}/report", h.ExportReport)

	// 1. Test Markdown Report
	req := httptest.NewRequest(http.MethodGet, "/exports/run-delft3d-001/report?case_id=tehri-dam", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	body := w.Body.String()
	if !strings.Contains(body, "EMERGENCY ACTION PLAN (EAP)") {
		t.Errorf("expected EAP header in markdown report")
	}
	if !strings.Contains(body, "Dam Safety Act 2021") {
		t.Errorf("expected statutory mandate reference")
	}
	if !strings.Contains(body, "Google Open Buildings V3") {
		t.Errorf("expected Google Open Buildings V3 reference")
	}

	// 2. Test JSON Briefing
	reqJSON := httptest.NewRequest(http.MethodGet, "/exports/run-delft3d-001/report?case_id=tehri-dam&format=json", nil)
	wJSON := httptest.NewRecorder()
	r.ServeHTTP(wJSON, reqJSON)

	if wJSON.Code != http.StatusOK {
		t.Fatalf("expected status 200 for JSON, got %d", wJSON.Code)
	}

	var dto reportgen.EAPBriefingDTO
	if err := json.Unmarshal(wJSON.Body.Bytes(), &dto); err != nil {
		t.Fatalf("failed to decode JSON EAP briefing: %v", err)
	}

	if dto.TotalStructures != 6252 {
		t.Errorf("expected 6252 total structures, got %d", dto.TotalStructures)
	}
	if dto.GoogleBuildingsCount != 3842 {
		t.Errorf("expected 3842 Google buildings, got %d", dto.GoogleBuildingsCount)
	}
	if len(dto.DepthHazardBands) != 4 {
		t.Errorf("expected 4 depth hazard bands, got %d", len(dto.DepthHazardBands))
	}
}

func TestExportGISVectors(t *testing.T) {
	h := NewExportHandler()

	r := chi.NewRouter()
	r.Get("/exports/{runId}/kml", h.ExportKML)
	r.Get("/exports/{runId}/geojson", h.ExportGeoJSON)
	r.Get("/exports/{runId}/shp", h.ExportShapefile)

	// KML
	reqKML := httptest.NewRequest(http.MethodGet, "/exports/run-001/kml?case_id=tehri-dam", nil)
	wKML := httptest.NewRecorder()
	r.ServeHTTP(wKML, reqKML)
	if wKML.Code != http.StatusOK {
		t.Errorf("expected KML 200, got %d", wKML.Code)
	}

	// GeoJSON
	reqGeo := httptest.NewRequest(http.MethodGet, "/exports/run-001/geojson?case_id=tehri-dam", nil)
	wGeo := httptest.NewRecorder()
	r.ServeHTTP(wGeo, reqGeo)
	if wGeo.Code != http.StatusOK {
		t.Errorf("expected GeoJSON 200, got %d", wGeo.Code)
	}

	// Shapefile ZIP
	reqSHP := httptest.NewRequest(http.MethodGet, "/exports/run-001/shp?case_id=tehri-dam", nil)
	wSHP := httptest.NewRecorder()
	r.ServeHTTP(wSHP, reqSHP)
	if wSHP.Code != http.StatusOK {
		t.Errorf("expected Shapefile ZIP 200, got %d", wSHP.Code)
	}
}
