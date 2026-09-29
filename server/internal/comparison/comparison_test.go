package comparison

import (
	"testing"
)

func TestComputeCrossValidation(t *testing.T) {
	metrics := ComputeCrossValidation("delft3d-fm", "dualsphysics")

	if metrics.FloodExtentIoU < 0.80 {
		t.Errorf("expected IoU >= 0.80, got %f", metrics.FloodExtentIoU)
	}
	if metrics.NashSutcliffe < 0.90 {
		t.Errorf("expected NSE >= 0.90, got %f", metrics.NashSutcliffe)
	}
	if len(metrics.StationComparisons) == 0 {
		t.Errorf("expected station comparisons to be populated")
	}
}

func TestComputeObservedValidation(t *testing.T) {
	obs := ComputeObservedValidation()

	if obs.EventName != "Rishi Ganga & Dhauliganga Flash Flood Disaster" {
		t.Errorf("unexpected event name: %s", obs.EventName)
	}
	if obs.CriticalSuccess < 0.08 {
		t.Errorf("expected empirical CSI >= 0.08, got %f", obs.CriticalSuccess)
	}
	if obs.Precision <= 0 || obs.Recall <= 0 {
		t.Errorf("invalid precision/recall: p=%f, r=%f", obs.Precision, obs.Recall)
	}
	if obs.TruePositiveKm2 <= 0 {
		t.Errorf("expected positive true positive area, got %f", obs.TruePositiveKm2)
	}
}
