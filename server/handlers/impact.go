package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sih26161/backend/internal/impact"
)

type ImpactHandler struct {
	db *sql.DB
}

func NewImpactHandler(db *sql.DB) *ImpactHandler {
	return &ImpactHandler{db: db}
}

func (h *ImpactHandler) GetSimulationImpact(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"simulation run id required"}`, http.StatusBadRequest)
		return
	}

	report := impact.CalculateSimulationImpact(id)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(report)
}
