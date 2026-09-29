package reportgen

import (
	"strings"
	"testing"
)

func TestGenerateEAPBriefing_Tehri(t *testing.T) {
	out := GenerateEAPBriefing("run-delft3d-001", "tehri-dam")
	text := string(out)

	if !strings.Contains(text, "Dam Safety Act 2021") {
		t.Errorf("expected report to cite Dam Safety Act 2021")
	}

	if !strings.Contains(text, "Google Open Buildings V3") {
		t.Errorf("expected report to feature Google Open Buildings V3")
	}

	if !strings.Contains(text, "3842") {
		t.Errorf("expected Google Open Buildings count 3842")
	}

	// Verify the 4 standardized depth hazard bands
	bands := []string{"< 0.50m", "0.50m - 2.00m", "2.00m - 5.00m", "> 5.00m"}
	for _, b := range bands {
		if !strings.Contains(text, b) {
			t.Errorf("expected report to contain depth band %s", b)
		}
	}

	// Verify stations
	if !strings.Contains(text, "Koteshwar Dam") || !strings.Contains(text, "16 min") {
		t.Errorf("expected Koteshwar Dam with 16 min arrival time")
	}
	if !strings.Contains(text, "Devprayag Confluence") || !strings.Contains(text, "52 min") {
		t.Errorf("expected Devprayag Confluence with 52 min arrival time")
	}
	if !strings.Contains(text, "Haridwar Barrage") || !strings.Contains(text, "188 min") {
		t.Errorf("expected Haridwar Barrage with 188 min arrival time")
	}
}

func TestGenerateEAPBriefing_RishiGanga(t *testing.T) {
	out := GenerateEAPBriefing("run-rg-001", "rishi-ganga")
	text := string(out)

	if !strings.Contains(text, "Rishi Ganga & Tapovan Hydropower Complex") {
		t.Errorf("expected Rishi Ganga dam name")
	}

	if !strings.Contains(text, "Raini Village & Confluence") {
		t.Errorf("expected Raini Village station")
	}

	if !strings.Contains(text, "Tapovan Vishnugad Headworks") {
		t.Errorf("expected Tapovan Vishnugad station")
	}

	if !strings.Contains(text, "Sentinel-1") || !strings.Contains(text, "Sentinel-2") {
		t.Errorf("expected multi-sensor satellite telemetry citations")
	}
}

func TestGetEAPBriefingData_AllCases(t *testing.T) {
	cases := []string{"tehri-dam", "rishi-ganga", "sardar-sarovar-dam", "bhakra-dam", "idukki-dam"}

	for _, c := range cases {
		dto := GetEAPBriefingData("run-test-all", c)
		if dto.CaseID != c {
			t.Errorf("expected case %s, got %s", c, dto.CaseID)
		}
		if len(dto.Stations) == 0 {
			t.Errorf("expected non-empty stations for %s", c)
		}
		if len(dto.DepthHazardBands) != 4 {
			t.Errorf("expected exactly 4 depth hazard bands for %s, got %d", c, len(dto.DepthHazardBands))
		}
		if dto.TotalStructures <= 0 {
			t.Errorf("expected positive total structures for %s, got %d", c, dto.TotalStructures)
		}
		if dto.GoogleBuildingsCount <= 0 {
			t.Errorf("expected positive Google Open Buildings count for %s, got %d", c, dto.GoogleBuildingsCount)
		}
	}
}
