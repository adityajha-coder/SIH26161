package handlers

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sih26161/backend/internal/gisexport"
)

type ExportHandler struct{}

func NewExportHandler() *ExportHandler {
	return &ExportHandler{}
}

func (h *ExportHandler) ExportKML(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runId")
	if runID == "" {
		runID = "latest"
	}

	data := gisexport.GenerateKML(runID)
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

	data := gisexport.GenerateGeoJSON(runID)
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

	data, err := gisexport.GenerateShapefileZIP(runID)
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

	data := gisexport.GenerateExecutiveReport(runID)
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"inundation_assessment_report_%s.md\"", runID))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}
