package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type CaseHandler struct {
	db *sql.DB
}

func NewCaseHandler(db *sql.DB) *CaseHandler {
	return &CaseHandler{db: db}
}

type SettlementDTO struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Type           string  `json:"type"`
	Population     int     `json:"population"`
	ElevationM     float64 `json:"elevation_m"`
	DistanceDamKm  float64 `json:"distance_from_dam_km"`
	Coordinates    []float64 `json:"coordinates"`
}

type DamDTO struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	DamType           string  `json:"dam_type"`
	HeightM           float64 `json:"height_m"`
	CrestLengthM      float64 `json:"crest_length_m"`
	GrossStorageMCM   float64 `json:"gross_storage_mcm"`
	EffectiveStorage  float64 `json:"effective_storage_mcm"`
	FullReservoirLvl  float64 `json:"full_reservoir_level_m"`
	MaxWaterLevelM    float64 `json:"max_water_level_m"`
	CrestElevationM   float64 `json:"crest_elevation_m"`
	SpillwayType      string  `json:"spillway_type"`
	SpillwayCapacity  float64 `json:"spillway_capacity_cumec"`
	YearCompleted     int     `json:"year_completed"`
	Coordinates       []float64 `json:"coordinates"`
}

type CaseDTO struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	State       string          `json:"state"`
	Basin       string          `json:"basin"`
	ReachLengthKm float64       `json:"reach_length_km"`
	Dam         *DamDTO         `json:"dam,omitempty"`
	Settlements []SettlementDTO `json:"settlements,omitempty"`
}

func (h *CaseHandler) ListCases(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, `{"error":"database unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	rows, err := h.db.Query(`
		SELECT id, name, description, state, basin
		FROM cases
		ORDER BY id ASC
	`)
	if err != nil {
		http.Error(w, `{"error":"failed to query cases"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var cases []CaseDTO
	for rows.Next() {
		var c CaseDTO
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.State, &c.Basin); err != nil {
			continue
		}

		// Fetch dam
		var d DamDTO
		var lon, lat sql.NullFloat64
		err := h.db.QueryRow(`
			SELECT id, name, dam_type, height_m, crest_length_m, gross_storage_mcm,
			       effective_storage_mcm, full_reservoir_level_m, max_water_level_m,
			       crest_elevation_m, spillway_type, spillway_capacity_cumec, year_completed,
			       ST_X(geom::geometry), ST_Y(geom::geometry)
			FROM dams
			WHERE case_id = $1
			LIMIT 1
		`, c.ID).Scan(
			&d.ID, &d.Name, &d.DamType, &d.HeightM, &d.CrestLengthM, &d.GrossStorageMCM,
			&d.EffectiveStorage, &d.FullReservoirLvl, &d.MaxWaterLevelM, &d.CrestElevationM,
			&d.SpillwayType, &d.SpillwayCapacity, &d.YearCompleted, &lon, &lat,
		)
		if err == nil {
			if lon.Valid && lat.Valid {
				d.Coordinates = []float64{lon.Float64, lat.Float64}
			}
			c.Dam = &d
		}

		// Fetch river reach length
		var reachLen sql.NullFloat64
		_ = h.db.QueryRow(`SELECT reach_length_km FROM rivers WHERE case_id = $1 LIMIT 1`, c.ID).Scan(&reachLen)
		if reachLen.Valid {
			c.ReachLengthKm = reachLen.Float64
		}

		// Fetch settlements
		sRows, err := h.db.Query(`
			SELECT id, name, type, population, elevation_m, distance_from_dam_km,
			       ST_X(geom::geometry), ST_Y(geom::geometry)
			FROM settlements
			WHERE case_id = $1
			ORDER BY distance_from_dam_km ASC
		`, c.ID)
		if err == nil {
			for sRows.Next() {
				var s SettlementDTO
				var slon, slat sql.NullFloat64
				if err := sRows.Scan(&s.ID, &s.Name, &s.Type, &s.Population, &s.ElevationM, &s.DistanceDamKm, &slon, &slat); err == nil {
					if slon.Valid && slat.Valid {
						s.Coordinates = []float64{slon.Float64, slat.Float64}
					}
					c.Settlements = append(c.Settlements, s)
				}
			}
			sRows.Close()
		}

		cases = append(cases, c)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(cases)
}

func (h *CaseHandler) GetCase(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.db == nil {
		http.Error(w, `{"error":"database unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	var c CaseDTO
	err := h.db.QueryRow(`
		SELECT id, name, description, state, basin
		FROM cases
		WHERE id = $1
	`, id).Scan(&c.ID, &c.Name, &c.Description, &c.State, &c.Basin)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"case not found"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(c)
}
