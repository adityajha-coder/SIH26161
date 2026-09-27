package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sih26161/backend/internal/observation"
)

type ObservationHandler struct {
	worker *observation.ObservationWorker
}

func NewObservationHandler(worker *observation.ObservationWorker) *ObservationHandler {
	return &ObservationHandler{worker: worker}
}

func (h *ObservationHandler) GetLatest(w http.ResponseWriter, r *http.Request) {
	caseID := r.URL.Query().Get("caseId")
	if caseID == "" {
		caseID = "tehri-dam"
	}

	products := observation.GetLatestObservations(caseID)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(products)
}

func (h *ObservationHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	products := observation.GetLatestObservations("tehri-dam")

	for _, p := range products {
		if p.SourceID == id {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(p)
			return
		}
	}

	http.Error(w, `{"error":"observation product not found"}`, http.StatusNotFound)
}

func (h *ObservationHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	caseID := r.URL.Query().Get("caseId")
	if caseID == "" {
		caseID = "tehri-dam"
	}

	var products []observation.ObservationProductDTO
	if h.worker != nil {
		products = h.worker.RefreshObservations(caseID)
	} else {
		products = observation.GetLatestObservations(caseID)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "refreshed",
		"products": products,
	})
}
