package gisexport

import (
	"strings"
	"testing"
)

func TestGenerateKML(t *testing.T) {
	kml := GenerateKML("run-001")
	str := string(kml)

	if !strings.Contains(str, "<kml") || !strings.Contains(str, "</kml>") {
		t.Errorf("invalid KML structure")
	}
	if !strings.Contains(str, "Tehri Dam") {
		t.Errorf("missing landmark placemark in KML")
	}
}

func TestGenerateGeoJSON(t *testing.T) {
	geo := GenerateGeoJSON("run-001")
	str := string(geo)

	if !strings.Contains(str, "FeatureCollection") {
		t.Errorf("invalid GeoJSON FeatureCollection")
	}
	if !strings.Contains(str, "coordinates") {
		t.Errorf("missing coordinates in GeoJSON")
	}
}

func TestGenerateShapefileZIP(t *testing.T) {
	zipBytes, err := GenerateShapefileZIP("run-001")
	if err != nil {
		t.Fatalf("failed to generate shapefile zip: %v", err)
	}
	if len(zipBytes) < 50 {
		t.Errorf("zip payload too small: %d bytes", len(zipBytes))
	}
}

func TestGenerateExecutiveReport(t *testing.T) {
	rep := GenerateExecutiveReport("run-001")
	str := string(rep)

	if !strings.Contains(str, "EXECUTIVE INUNDATION ASSESSMENT REPORT") {
		t.Errorf("invalid executive report header")
	}
	if !strings.Contains(str, "Delft3D FM") {
		t.Errorf("missing solver details in report")
	}
}

func TestMultiDamExports(t *testing.T) {
	dams := []struct {
		caseID   string
		damName  string
		river    string
	}{
		{"tehri-dam", "Tehri Dam", "Bhagirathi"},
		{"sardar-sarovar-dam", "Sardar Sarovar Dam", "Narmada"},
		{"bhakra-dam", "Bhakra Dam", "Satluj"},
		{"idukki-dam", "Idukki Arch Dam", "Periyar"},
	}

	for _, d := range dams {
		kml := string(GenerateKML("run-test", d.caseID))
		if !strings.Contains(kml, d.damName) {
			t.Errorf("KML for %s missing dam name %s", d.caseID, d.damName)
		}

		geo := string(GenerateGeoJSON("run-test", d.caseID))
		if !strings.Contains(geo, d.damName) || !strings.Contains(geo, d.caseID) {
			t.Errorf("GeoJSON for %s missing dam metadata", d.caseID)
		}

		zipBytes, err := GenerateShapefileZIP("run-test", d.caseID)
		if err != nil || len(zipBytes) < 100 {
			t.Errorf("Shapefile ZIP for %s failed: err=%v len=%d", d.caseID, err, len(zipBytes))
		}

		rep := string(GenerateExecutiveReport("run-test", d.caseID))
		if !strings.Contains(rep, d.damName) {
			t.Errorf("Executive Report for %s missing dam name", d.caseID)
		}
	}
}
