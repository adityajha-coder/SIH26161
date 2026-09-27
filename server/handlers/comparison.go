package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/sih26161/backend/internal/comparison"
)

type ComparisonHandler struct {
	db *sql.DB
}

func NewComparisonHandler(db *sql.DB) *ComparisonHandler {
	return &ComparisonHandler{db: db}
}

func (h *ComparisonHandler) GetCrossValidation(w http.ResponseWriter, r *http.Request) {
	solverA := r.URL.Query().Get("solver_a")
	if solverA == "" {
		solverA = "delft3d-fm"
	}
	solverB := r.URL.Query().Get("solver_b")
	if solverB == "" {
		solverB = "dualsphysics"
	}

	metrics := comparison.ComputeCrossValidation(solverA, solverB)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(metrics)
}

func (h *ComparisonHandler) GetObservedValidation(w http.ResponseWriter, r *http.Request) {
	obs := comparison.ComputeObservedValidation()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obs)
}
