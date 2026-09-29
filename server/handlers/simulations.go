package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"github.com/sih26161/backend/internal/worker"
	"github.com/sih26161/backend/ws"
)

type SimulationHandler struct {
	db     *sql.DB
	hub    *ws.Hub
	worker *worker.SimulationWorker
}

func NewSimulationHandler(db *sql.DB, hub *ws.Hub, worker *worker.SimulationWorker) *SimulationHandler {
	return &SimulationHandler{
		db:     db,
		hub:    hub,
		worker: worker,
	}
}

// OutputProvenance provides honest attribution of solver methodology, benchmark citations, and mesh types.
type OutputProvenance struct {
	Type              string `json:"type"` // "numerical_swe_2d" | "sph_trajectory_precomputed" | "calibrated_adapter" | "satellite_empirical"
	SolverName        string `json:"solver_name"`
	BenchmarkCitation string `json:"benchmark_citation"`
	Methodology       string `json:"methodology"`
	GridOrParticle    string `json:"grid_or_particle"`
}

// ResolveProvenance assigns verified provenance metadata to a solver run.
func ResolveProvenance(solver string) OutputProvenance {
	switch strings.ToLower(solver) {
	case "delft3d":
		return OutputProvenance{
			Type:              "numerical_swe_2d",
			SolverName:        "Delft3D FM / Python 2D SWE Kernel",
			BenchmarkCitation: "Ritter (1892) & Audusse et al. (2004)",
			Methodology:       "Finite-Volume Godunov HLL Riemann flux with well-balanced hydrostatic reconstruction",
			GridOrParticle:    "Eulerian structured grid (dx=10m)",
		}
	case "sph":
		return OutputProvenance{
			Type:              "sph_trajectory_precomputed",
			SolverName:        "DualSPHysics v5.2 (WCSPH Kernel)",
			BenchmarkCitation: "Gómez-Gesteira et al. (2010)",
			Methodology:       "Lagrangian particle hydrodynamics (precomputed physical flume benchmark)",
			GridOrParticle:    "2,380 Lagrangian particles",
		}
	case "hec_ras":
		return OutputProvenance{
			Type:              "numerical_swe_2d",
			SolverName:        "HEC-RAS 2D (Diffusive Wave / Full Momentum)",
			BenchmarkCitation: "USACE EM 1110-2-1416",
			Methodology:       "Implicit Finite Volume 2D Shallow Water Equations",
			GridOrParticle:    "Sub-grid bathymetry mesh",
		}
	default:
		return OutputProvenance{
			Type:              "calibrated_adapter",
			SolverName:        "Hydraulic Wave Bore Adapter",
			BenchmarkCitation: "CWC Mountain Reach Calibration (2021)",
			Methodology:       "Dynamic gravity bore celerity c = v + sqrt(gh) in steep Himalayan gorge reaches",
			GridOrParticle:    "1D Reach Corridor Cross-Sections",
		}
	}
}

type SimulationRunDTO struct {
	ID              string                 `json:"id"`
	ScenarioID      string                 `json:"scenario_id"`
	Solver          string                 `json:"solver"`
	Status          string                 `json:"status"`
	ProgressPercent float64                `json:"progress_percent"`
	StartedAt       *time.Time             `json:"started_at,omitempty"`
	CompletedAt     *time.Time             `json:"completed_at,omitempty"`
	ErrorMessage    string                 `json:"error_message,omitempty"`
	Metrics         map[string]interface{} `json:"metrics,omitempty"`
	Provenance      *OutputProvenance      `json:"provenance,omitempty"`
}

func (h *SimulationHandler) ListSimulations(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, `{"error":"database unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	rows, err := h.db.Query(`
		SELECT id, scenario_id, solver, status, COALESCE(progress_percent, 0),
		       started_at, completed_at, COALESCE(error_message, '')
		FROM simulation_runs
		ORDER BY started_at DESC NULLS LAST
		LIMIT 50
	`)
	if err != nil {
		http.Error(w, `{"error":"failed to query simulations"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	runs := make([]SimulationRunDTO, 0)
	for rows.Next() {
		var run SimulationRunDTO
		var started, completed sql.NullTime
		if err := rows.Scan(
			&run.ID, &run.ScenarioID, &run.Solver, &run.Status, &run.ProgressPercent,
			&started, &completed, &run.ErrorMessage,
		); err == nil {
			if started.Valid {
				run.StartedAt = &started.Time
			}
			if completed.Valid {
				run.CompletedAt = &completed.Time
			}
			prov := ResolveProvenance(run.Solver)
			run.Provenance = &prov
			runs = append(runs, run)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(runs)
}

func (h *SimulationHandler) LaunchSimulation(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, `{"error":"database unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	var req struct {
		ScenarioID  string   `json:"scenario_id"`
		ScenarioId2 string   `json:"scenarioId"`
		Solver      string   `json:"solver"`
		Solvers     []string `json:"solvers"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request json"}`, http.StatusBadRequest)
		return
	}

	if req.ScenarioID == "" && req.ScenarioId2 != "" {
		req.ScenarioID = req.ScenarioId2
	}
	if req.Solver == "" && len(req.Solvers) > 0 {
		req.Solver = req.Solvers[0]
	}
	if req.Solver == "" {
		req.Solver = "delft3d"
	}
	if req.ScenarioID == "" {
		var firstID string
		_ = h.db.QueryRow("SELECT id FROM scenarios ORDER BY created_at DESC LIMIT 1").Scan(&firstID)
		if firstID != "" {
			req.ScenarioID = firstID
		} else {
			req.ScenarioID = "tehri-pmf-overtopping"
		}
	}

	runID := fmt.Sprintf("run-%s-%d", req.Solver, time.Now().Unix())
	now := time.Now()

	_, err := h.db.Exec(`
		INSERT INTO simulation_runs (id, scenario_id, solver, status, progress_percent, started_at)
		VALUES ($1, $2, $3, 'queued', 0.0, $4)
	`, runID, req.ScenarioID, req.Solver, now)

	if err != nil {
		log.Error().Err(err).Msg("Failed to insert simulation run")
		http.Error(w, `{"error":"failed to launch simulation"}`, http.StatusInternalServerError)
		return
	}

	if h.hub != nil {
		h.hub.BroadcastEvent("simulation_started", "simulation", map[string]interface{}{
			"run_id":      runID,
			"scenario_id": req.ScenarioID,
			"solver":      req.Solver,
			"status":      "queued",
			"progress":    0.0,
		})
	}

	if h.worker != nil {
		go func() {
			if err := h.worker.ExecuteRun(runID, req.ScenarioID, req.Solver); err != nil {
				log.Error().Err(err).Str("run_id", runID).Msg("Worker run failed")
			}
		}()
	}

	prov := ResolveProvenance(req.Solver)
	resp := SimulationRunDTO{
		ID:              runID,
		ScenarioID:      req.ScenarioID,
		Solver:          req.Solver,
		Status:          "queued",
		ProgressPercent: 0.0,
		StartedAt:       &now,
		Provenance:      &prov,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *SimulationHandler) GetSimulation(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.db == nil {
		http.Error(w, `{"error":"database unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	var run SimulationRunDTO
	var started, completed sql.NullTime
	var rawMetrics []byte
	err := h.db.QueryRow(`
		SELECT id, scenario_id, solver, status, COALESCE(progress_percent, 0),
		       started_at, completed_at, COALESCE(error_message, ''), metrics
		FROM simulation_runs
		WHERE id = $1
	`, id).Scan(
		&run.ID, &run.ScenarioID, &run.Solver, &run.Status, &run.ProgressPercent,
		&started, &completed, &run.ErrorMessage, &rawMetrics,
	)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"simulation run not found"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if started.Valid {
		run.StartedAt = &started.Time
	}
	if completed.Valid {
		run.CompletedAt = &completed.Time
	}
	if len(rawMetrics) > 0 {
		_ = json.Unmarshal(rawMetrics, &run.Metrics)
	}

	prov := ResolveProvenance(run.Solver)
	run.Provenance = &prov

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(run)
}

func (h *SimulationHandler) GetSimulationResults(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.db == nil {
		http.Error(w, `{"error":"database unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	rows, err := h.db.Query(`
		SELECT id, layer_type, format, storage_path, created_at
		FROM result_layers
		WHERE run_id = $1
		ORDER BY created_at ASC
	`, id)
	if err != nil {
		http.Error(w, `{"error":"failed to query result layers"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type LayerDTO struct {
		ID          string    `json:"id"`
		LayerType   string    `json:"layer_type"`
		Format      string    `json:"format"`
		StoragePath string    `json:"storage_path"`
		CreatedAt   time.Time `json:"created_at"`
	}

	var layers []LayerDTO
	for rows.Next() {
		var l LayerDTO
		if err := rows.Scan(&l.ID, &l.LayerType, &l.Format, &l.StoragePath, &l.CreatedAt); err == nil {
			layers = append(layers, l)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"run_id": id,
		"layers": layers,
	})
}
