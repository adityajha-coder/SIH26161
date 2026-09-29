package gisexport

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"io"
	"strings"
	"testing"
)

func TestEnsureClockwise(t *testing.T) {
	// CCW unclosed square: (0,0) -> (1,0) -> (1,1) -> (0,1)
	ccw := [][2]float64{
		{0, 0},
		{1, 0},
		{1, 1},
		{0, 1},
	}

	cw := EnsureClockwise(ccw)

	// Must be closed (5 vertices)
	if len(cw) != 5 {
		t.Fatalf("expected 5 vertices (closed loop), got %d", len(cw))
	}
	if cw[0] != cw[4] {
		t.Errorf("expected closed loop with first vertex == last vertex, got %v != %v", cw[0], cw[4])
	}

	// Verify signed area is negative (Clockwise in geographic coords)
	var signedArea float64
	for i := 0; i < len(cw)-1; i++ {
		signedArea += (cw[i][0] * cw[i+1][1]) - (cw[i+1][0] * cw[i][1])
	}
	if signedArea >= 0 {
		t.Errorf("expected negative signed area for ESRI clockwise polygon, got %f", signedArea)
	}

	// Now pass already-CW polygon
	cwAgain := EnsureClockwise(cw)
	var area2 float64
	for i := 0; i < len(cwAgain)-1; i++ {
		area2 += (cwAgain[i][0] * cwAgain[i+1][1]) - (cwAgain[i+1][0] * cwAgain[i][1])
	}
	if area2 >= 0 {
		t.Errorf("expected CW polygon to remain negative signed area, got %f", area2)
	}
}

func TestShapefileIndexStructure(t *testing.T) {
	zipBytes, err := GenerateShapefileZIP("run-001")
	if err != nil {
		t.Fatalf("failed to generate shapefile zip: %v", err)
	}

	r, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		t.Fatalf("failed to open shapefile zip: %v", err)
	}

	var foundShx bool
	for _, f := range r.File {
		if strings.HasSuffix(f.Name, ".shx") {
			foundShx = true
			rc, err := f.Open()
			if err != nil {
				t.Fatalf("failed to open .shx: %v", err)
			}
			shxData, _ := io.ReadAll(rc)
			_ = rc.Close()

			// 100 bytes header + 8 bytes (1 index record) = 108 bytes
			if len(shxData) != 108 {
				t.Errorf("expected .shx length 108 bytes (54 words), got %d", len(shxData))
			}

			// File length in header at bytes 24-27 (BigEndian words)
			fileLengthWords := binary.BigEndian.Uint32(shxData[24:28])
			if fileLengthWords != 54 {
				t.Errorf("expected file length 54 words in .shx header, got %d", fileLengthWords)
			}

			// First record offset at bytes 100-103 (BigEndian 16-bit words)
			recordOffsetWords := binary.BigEndian.Uint32(shxData[100:104])
			if recordOffsetWords != 50 {
				t.Errorf("expected first record offset 50 words (100 bytes) in .shx, got %d", recordOffsetWords)
			}
		}
	}

	if !foundShx {
		t.Errorf("no .shx file found in shapefile zip bundle")
	}
}

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
