package impact

import (
	"testing"
)

func TestCalculateSimulationImpact(t *testing.T) {
	report := CalculateSimulationImpact("run-delft3d-001")

	if report.TotalPopulationExposed <= 0 {
		t.Errorf("expected exposed population > 0, got %d", report.TotalPopulationExposed)
	}

	if report.SubmergedRoadKm <= 0 {
		t.Errorf("expected submerged road km > 0, got %f", report.SubmergedRoadKm)
	}

	if report.EstimatedLossCr <= 0 {
		t.Errorf("expected loss estimate > 0, got %f", report.EstimatedLossCr)
	}

	if len(report.Settlements) == 0 {
		t.Errorf("expected settlements to be populated")
	}

	if len(report.DepthBands) != 4 {
		t.Errorf("expected 4 depth bands, got %d", len(report.DepthBands))
	}
}
