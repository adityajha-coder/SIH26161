package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sih26161/backend/internal/gisexport"
	"github.com/sih26161/backend/internal/reportgen"
)

type ExportHandler struct{}

func NewExportHandler() *ExportHandler {
	return &ExportHandler{}
}

func getCaseID(r *http.Request) string {
	c := r.URL.Query().Get("case_id")
	if c == "" {
		c = r.URL.Query().Get("caseId")
	}
	return c
}

func (h *ExportHandler) ExportKML(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runId")
	if runID == "" {
		runID = "latest"
	}
	caseID := getCaseID(r)

	data := gisexport.GenerateKML(runID, caseID)
	w.Header().Set("Content-Type", "application/vnd.google-earth.kml+xml")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"flood_extent_%s.kml\"", runID))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *ExportHandler) ExportGeoJSON(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runId")
	if runID == "" {
		runID = "latest"
	}
	caseID := getCaseID(r)

	data := gisexport.GenerateGeoJSON(runID, caseID)
	w.Header().Set("Content-Type", "application/geo+json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"flood_extent_%s.geojson\"", runID))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *ExportHandler) ExportShapefile(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runId")
	if runID == "" {
		runID = "latest"
	}
	caseID := getCaseID(r)

	data, err := gisexport.GenerateShapefileZIP(runID, caseID)
	if err != nil {
		http.Error(w, `{"error":"failed to generate shapefile zip"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"flood_extent_%s_shp.zip\"", runID))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *ExportHandler) ExportReport(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runId")
	if runID == "" {
		runID = "latest"
	}
	caseID := getCaseID(r)

	if r.URL.Query().Get("format") == "json" {
		data := reportgen.GetEAPBriefingData(runID, caseID)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(data)
		return
	}

	data := reportgen.GenerateEAPBriefing(runID, caseID)
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"eap_briefing_%s.md\"", runID))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}
