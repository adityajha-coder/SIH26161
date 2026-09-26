package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/sih26161/backend/db"
)

type HealthResponse struct {
	Status    string            `json:"status"`
	Service   string            `json:"service"`
	Version   string            `json:"version"`
	Timestamp string            `json:"timestamp"`
	Checks    map[string]string `json:"checks,omitempty"`
}

type HealthHandler struct {
	DB *db.Database
}

func NewHealthHandler(database *db.Database) *HealthHandler {
	return &HealthHandler{DB: database}
}

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	resp := HealthResponse{
		Status:    "ok",
		Service:   "sih26161-backend",
		Version:   "1.0.0",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *HealthHandler) HealthDB(w http.ResponseWriter, r *http.Request) {
	checks := make(map[string]string)
	status := "ok"
	statusCode := http.StatusOK

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if h.DB != nil {
		if err := h.DB.Ping(ctx); err != nil {
			checks["postgres"] = "unreachable: " + err.Error()
			status = "degraded"
			statusCode = http.StatusServiceUnavailable
		} else {
			checks["postgres"] = "healthy"
		}
	} else {
		checks["postgres"] = "not_configured"
		status = "degraded"
	}

	resp := HealthResponse{
		Status:    status,
		Service:   "sih26161-backend",
		Version:   "1.0.0",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Checks:    checks,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(resp)
}
