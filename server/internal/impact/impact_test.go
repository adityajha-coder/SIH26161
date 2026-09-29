package impact

import (
	"testing"
)

func TestCalculateSimulationImpact(t *testing.T) {
	report := CalculateSimulationImpact("run-delft3d-001", "tehri-dam")

	if report.TotalPopulationExposed <= 0 {
		t.Errorf("expected exposed population > 0, got %d", report.TotalPopulationExposed)
	}

	if report.TotalStructuresExposed != 6252 {
		t.Errorf("expected 6252 total structures exposed, got %d", report.TotalStructuresExposed)
	}

	if report.GoogleOpenBuildingsCount != 3842 {
		t.Errorf("expected 3842 Google Open Buildings, got %d", report.GoogleOpenBuildingsCount)
	}

	if report.OSMBuildingCount != 2410 {
		t.Errorf("expected 2410 OSM buildings, got %d", report.OSMBuildingCount)
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
		t.Fatalf("expected 4 depth bands, got %d", len(report.DepthBands))
	}

	expectedBands := []string{"< 0.50m", "0.50m - 2.00m", "2.00m - 5.00m", "> 5.00m"}
	for i, b := range report.DepthBands {
		if b.DepthRange != expectedBands[i] {
			t.Errorf("expected band %d range %s, got %s", i, expectedBands[i], b.DepthRange)
		}
		if b.BuildingCount <= 0 {
			t.Errorf("expected positive building count for band %d, got %d", i, b.BuildingCount)
		}
	}
}

func TestCalculateRishiGangaSimulationImpact(t *testing.T) {
	report := CalculateSimulationImpact("run-rg-001", "rishi-ganga")

	if report.CaseID != "rishi-ganga" {
		t.Errorf("expected case_id rishi-ganga, got %s", report.CaseID)
	}

	if report.GoogleOpenBuildingsCount != 362 {
		t.Errorf("expected 362 Google Open Buildings for Rishi Ganga, got %d", report.GoogleOpenBuildingsCount)
	}

	if report.OSMBuildingCount != 56 {
		t.Errorf("expected 56 OSM buildings for Rishi Ganga, got %d", report.OSMBuildingCount)
	}

	if len(report.DepthBands) != 4 {
		t.Errorf("expected 4 depth bands, got %d", len(report.DepthBands))
	}
}
