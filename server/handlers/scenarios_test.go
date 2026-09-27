package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateScenarioValidation(t *testing.T) {
	h := NewScenarioHandler(nil)

	// Test physically impossible reservoir level
	badPayload := map[string]interface{}{
		"case_id":                     "tehri-dam",
		"trigger_type":                "overtopping",
		"reservoir_level_at_failure_m": 999.0, // Exceeds 839.5m crest
		"released_volume_mcm":         2100.0,
	}
	body, _ := json.Marshal(badPayload)
	req := httptest.NewRequest("POST", "/api/v1/scenarios", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.CreateScenario(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422 Unprocessable Entity, got %d", w.Code)
	}

	var resp map[string]string
	_ = json.NewDecoder(w.Body).Decode(&resp)
	if resp["error"] == "" {
		t.Errorf("expected error message in response, got empty")
	}
}
