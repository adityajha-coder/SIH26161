package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	"github.com/sih26161/backend/internal/breach"
)

type ScenarioHandler struct {
	db *sql.DB
}

func NewScenarioHandler(db *sql.DB) *ScenarioHandler {
	return &ScenarioHandler{db: db}
}

type ScenarioDTO struct {
	ID                     string                 `json:"id"`
	CaseID                 string                 `json:"case_id"`
	Name                   string                 `json:"name"`
	Description            string                 `json:"description"`
	TriggerType            string                 `json:"trigger_type"`
	BreachFormationTimeHr  float64                `json:"breach_formation_time_hr"`
	FinalBreachWidthM      float64                `json:"final_breach_width_m"`
	FinalBreachDepthM      float64                `json:"final_breach_depth_m"`
	PeakDischargeCumec     float64                `json:"peak_discharge_cumec"`
	ReservoirLevelAtFailM  float64                `json:"reservoir_level_at_failure_m"`
	InflowHydrograph       map[string]interface{} `json:"inflow_hydrograph,omitempty"`
	CreatedAt              time.Time              `json:"created_at"`
}

func (h *ScenarioHandler) ListScenarios(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, `{"error":"database unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	caseID := r.URL.Query().Get("case_id")
	query := `
		SELECT id, case_id, name, COALESCE(description, ''), trigger_type,
		       COALESCE(breach_formation_time_hr, 0), COALESCE(final_breach_width_m, 0),
		       COALESCE(final_breach_depth_m, 0), COALESCE(peak_discharge_cumec, 0),
		       COALESCE(reservoir_level_at_failure_m, 0), created_at
		FROM scenarios
	`
	var rows *sql.Rows
	var err error
	if caseID != "" {
		query += ` WHERE case_id = $1 ORDER BY created_at DESC`
		rows, err = h.db.Query(query, caseID)
	} else {
		query += ` ORDER BY created_at DESC`
		rows, err = h.db.Query(query)
	}

	if err != nil {
		http.Error(w, `{"error":"failed to query scenarios"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var scenarios []ScenarioDTO
	for rows.Next() {
		var s ScenarioDTO
		if err := rows.Scan(
			&s.ID, &s.CaseID, &s.Name, &s.Description, &s.TriggerType,
			&s.BreachFormationTimeHr, &s.FinalBreachWidthM, &s.FinalBreachDepthM,
			&s.PeakDischargeCumec, &s.ReservoirLevelAtFailM, &s.CreatedAt,
		); err == nil {
			scenarios = append(scenarios, s)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(scenarios)
}

func (h *ScenarioHandler) CreateScenario(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CaseID                 string  `json:"case_id"`
		Name                   string  `json:"name"`
		Description            string  `json:"description"`
		TriggerType            string  `json:"trigger_type"`
		BreachFormationTimeHr  float64 `json:"breach_formation_time_hr"`
		FinalBreachWidthM      float64 `json:"final_breach_width_m"`
		FinalBreachDepthM      float64 `json:"final_breach_depth_m"`
		PeakDischargeCumec     float64 `json:"peak_discharge_cumec"`
		ReservoirLevelAtFailM  float64 `json:"reservoir_level_at_failure_m"`
		ReleasedVolumeMCM      float64 `json:"released_volume_mcm"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request json"}`, http.StatusBadRequest)
		return
	}

	if req.CaseID == "" {
		req.CaseID = "tehri-dam"
	}
	if req.ReleasedVolumeMCM <= 0 {
		req.ReleasedVolumeMCM = 2100.0
	}
	if req.ReservoirLevelAtFailM <= 0 {
		req.ReservoirLevelAtFailM = 830.0
	}

	bParams := breach.BreachParams{
		CaseID:              req.CaseID,
		TriggerType:         req.TriggerType,
		ReservoirLevelM:     req.ReservoirLevelAtFailM,
		ReleasedVolumeMCM:   req.ReleasedVolumeMCM,
		BreachWidthM:        req.FinalBreachWidthM,
		BreachDepthM:        req.FinalBreachDepthM,
		FormationTimeHr:     req.BreachFormationTimeHr,
		SimulationHorizonHr: 18.0,
	}

	if err := breach.ValidatePreSolver(&bParams); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	hResult := breach.CalculateFroehlichBreach(bParams)
	if req.PeakDischargeCumec <= 0 {
		req.PeakDischargeCumec = hResult.PeakDischargeCumec
	}
	if req.BreachFormationTimeHr <= 0 {
		req.BreachFormationTimeHr = hResult.FormationTimeHr
	}
	if req.FinalBreachWidthM <= 0 {
		req.FinalBreachWidthM = hResult.BreachWidthM
	}
	if req.FinalBreachDepthM <= 0 {
		req.FinalBreachDepthM = 150.0
	}

	if req.Name == "" {
		req.Name = fmt.Sprintf("Scenario %s (%s)", req.TriggerType, time.Now().Format("2006-01-02 15:04"))
	}

	id := fmt.Sprintf("scen-%s-%d", req.CaseID, time.Now().Unix())

	var createdAt time.Time
	if h.db != nil {
		insertSQL := `
			INSERT INTO scenarios (
				id, case_id, name, description, trigger_type,
				breach_formation_time_hr, final_breach_width_m, final_breach_depth_m,
				peak_discharge_cumec, reservoir_level_at_failure_m
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			RETURNING created_at;
		`
		err := h.db.QueryRow(
			insertSQL, id, req.CaseID, req.Name, req.Description, req.TriggerType,
			req.BreachFormationTimeHr, req.FinalBreachWidthM, req.FinalBreachDepthM,
			req.PeakDischargeCumec, req.ReservoirLevelAtFailM,
		).Scan(&createdAt)

		if err != nil {
			log.Error().Err(err).Msg("Failed to insert scenario")
			http.Error(w, `{"error":"failed to create scenario"}`, http.StatusInternalServerError)
			return
		}
	} else {
		createdAt = time.Now().UTC()
	}

	inflowMap := map[string]interface{}{
		"formula":              "Froehlich-2008",
		"mass_balance_ratio":   hResult.MassBalanceRatio,
		"mass_balance_passed":  hResult.MassBalancePassed,
		"total_integrated_mcm": hResult.TotalIntegratedMCM,
		"released_volume_mcm":  hResult.ReleasedVolumeMCM,
		"base_curve":          hResult.BaseCurve,
		"low_curve":           hResult.LowCurve,
		"high_curve":          hResult.HighCurve,
	}

	resp := ScenarioDTO{
		ID:                    id,
		CaseID:                req.CaseID,
		Name:                  req.Name,
		Description:           req.Description,
		TriggerType:           req.TriggerType,
		BreachFormationTimeHr: req.BreachFormationTimeHr,
		FinalBreachWidthM:     req.FinalBreachWidthM,
		FinalBreachDepthM:     req.FinalBreachDepthM,
		PeakDischargeCumec:    req.PeakDischargeCumec,
		ReservoirLevelAtFailM: req.ReservoirLevelAtFailM,
		InflowHydrograph:       inflowMap,
		CreatedAt:             createdAt,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *ScenarioHandler) GetScenario(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.db == nil {
		http.Error(w, `{"error":"database unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	var s ScenarioDTO
	err := h.db.QueryRow(`
		SELECT id, case_id, name, COALESCE(description, ''), trigger_type,
		       COALESCE(breach_formation_time_hr, 0), COALESCE(final_breach_width_m, 0),
		       COALESCE(final_breach_depth_m, 0), COALESCE(peak_discharge_cumec, 0),
		       COALESCE(reservoir_level_at_failure_m, 0), created_at
		FROM scenarios
		WHERE id = $1
	`, id).Scan(
		&s.ID, &s.CaseID, &s.Name, &s.Description, &s.TriggerType,
		&s.BreachFormationTimeHr, &s.FinalBreachWidthM, &s.FinalBreachDepthM,
		&s.PeakDischargeCumec, &s.ReservoirLevelAtFailM, &s.CreatedAt,
	)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"scenario not found"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(s)
}
