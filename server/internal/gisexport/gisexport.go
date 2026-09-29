package gisexport

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"fmt"
	"strings"
	"time"

	"github.com/sih26161/backend/internal/reportgen"
)

type StationExport struct {
	Name        string
	ChainageKm  float64
	PeakDepthM  float64
	ArrivalMin  int
	Coords      [2]float64
	Severity    string
}

type ExportProfile struct {
	CaseID           string
	DamName          string
	RiverName        string
	State            string
	Event            string
	ReachKm          float64
	MaxDepthM        float64
	PeakDischargeM3s float64
	FloodedAreaKm2   float64
	Coords           [][2]float64
	Stations         []StationExport
}

var Profiles = map[string]ExportProfile{
	"tehri-dam": {
		CaseID:           "tehri-dam",
		DamName:          "Tehri Dam",
		RiverName:        "Bhagirathi - Ganga River Corridor",
		State:            "Uttarakhand",
		Event:            "Tehri Dam Overtopping PMF",
		ReachKm:          105.0,
		MaxDepthM:        24.8,
		PeakDischargeM3s: 45000.0,
		FloodedAreaKm2:   86.4,
		Coords: [][2]float64{
			{78.4808, 30.3781},
			{78.4950, 30.3120},
			{78.5980, 30.1450},
			{78.2980, 30.0860},
			{78.1642, 29.9457},
			{78.1400, 29.9500},
			{78.2600, 30.1200},
			{78.4808, 30.3781},
		},
		Stations: []StationExport{
			{Name: "Tehri Dam Toe", ChainageKm: 0.0, PeakDepthM: 24.8, ArrivalMin: 0, Coords: [2]float64{78.4808, 30.3781}, Severity: "CRITICAL"},
			{Name: "New Tehri Gorge", ChainageKm: 5.0, PeakDepthM: 18.0, ArrivalMin: 5, Coords: [2]float64{78.4311, 30.3922}, Severity: "CRITICAL"},
			{Name: "Koteshwar Dam", ChainageKm: 15.0, PeakDepthM: 18.2, ArrivalMin: 16, Coords: [2]float64{78.5028, 30.2858}, Severity: "EXTREME"},
			{Name: "Devprayag Confluence", ChainageKm: 42.0, PeakDepthM: 14.6, ArrivalMin: 52, Coords: [2]float64{78.5986, 30.1458}, Severity: "HIGH"},
			{Name: "Rishikesh Foothills", ChainageKm: 84.0, PeakDepthM: 9.4, ArrivalMin: 130, Coords: [2]float64{78.2676, 30.0869}, Severity: "MODERATE"},
			{Name: "Haridwar Barrage", ChainageKm: 105.0, PeakDepthM: 4.2, ArrivalMin: 188, Coords: [2]float64{78.1642, 29.9457}, Severity: "MODERATE"},
		},
	},
	"sardar-sarovar-dam": {
		CaseID:           "sardar-sarovar-dam",
		DamName:          "Sardar Sarovar Dam",
		RiverName:        "Narmada River Corridor",
		State:            "Gujarat",
		Event:            "Sardar Sarovar PMF Surge",
		ReachKm:          115.0,
		MaxDepthM:        28.5,
		PeakDischargeM3s: 84900.0,
		FloodedAreaKm2:   142.0,
		Coords: [][2]float64{
			{73.7481, 21.8319},
			{73.7150, 21.8380},
			{73.5650, 21.7890},
			{73.3420, 21.9120},
			{72.9980, 21.7050},
			{72.8500, 21.6500},
			{72.8200, 21.6800},
			{73.0100, 21.7300},
			{73.3500, 21.9300},
			{73.7481, 21.8319},
		},
		Stations: []StationExport{
			{Name: "Sardar Sarovar Dam Toe", ChainageKm: 0.0, PeakDepthM: 28.5, ArrivalMin: 0, Coords: [2]float64{73.7481, 21.8319}, Severity: "CRITICAL"},
			{Name: "Garudeshwar Weir", ChainageKm: 12.0, PeakDepthM: 22.4, ArrivalMin: 18, Coords: [2]float64{73.6620, 21.8210}, Severity: "CRITICAL"},
			{Name: "Tilakwada Riverbank", ChainageKm: 28.0, PeakDepthM: 17.8, ArrivalMin: 45, Coords: [2]float64{73.5650, 21.7890}, Severity: "EXTREME"},
			{Name: "Rajpipla Plain", ChainageKm: 46.0, PeakDepthM: 12.5, ArrivalMin: 80, Coords: [2]float64{73.3420, 21.9120}, Severity: "HIGH"},
			{Name: "Bharuch Estuary", ChainageKm: 115.0, PeakDepthM: 5.8, ArrivalMin: 225, Coords: [2]float64{72.9980, 21.7050}, Severity: "MODERATE"},
		},
	},
	"bhakra-dam": {
		CaseID:           "bhakra-dam",
		DamName:          "Bhakra Dam",
		RiverName:        "Satluj River Corridor",
		State:            "Himachal Pradesh / Punjab",
		Event:            "Bhakra Dam High-Head Canyon Surge",
		ReachKm:          90.0,
		MaxDepthM:        32.4,
		PeakDischargeM3s: 52000.0,
		FloodedAreaKm2:   98.6,
		Coords: [][2]float64{
			{76.4358, 31.4103},
			{76.3810, 31.3700},
			{76.5020, 31.2350},
			{76.5680, 31.1810},
			{76.5270, 30.9660},
			{76.4800, 30.9700},
			{76.5300, 31.1900},
			{76.4600, 31.2500},
			{76.4358, 31.4103},
		},
		Stations: []StationExport{
			{Name: "Bhakra Dam Toe", ChainageKm: 0.0, PeakDepthM: 32.4, ArrivalMin: 0, Coords: [2]float64{76.4358, 31.4103}, Severity: "CRITICAL"},
			{Name: "Nangal Barrage", ChainageKm: 14.0, PeakDepthM: 24.1, ArrivalMin: 16, Coords: [2]float64{76.3810, 31.3700}, Severity: "CRITICAL"},
			{Name: "Anandpur Sahib", ChainageKm: 36.0, PeakDepthM: 16.5, ArrivalMin: 48, Coords: [2]float64{76.5020, 31.2350}, Severity: "EXTREME"},
			{Name: "Kiratpur Sahib", ChainageKm: 52.0, PeakDepthM: 11.8, ArrivalMin: 76, Coords: [2]float64{76.5680, 31.1810}, Severity: "HIGH"},
			{Name: "Rupnagar Headworks", ChainageKm: 90.0, PeakDepthM: 5.1, ArrivalMin: 175, Coords: [2]float64{76.5270, 30.9660}, Severity: "MODERATE"},
		},
	},
	"idukki-dam": {
		CaseID:           "idukki-dam",
		DamName:          "Idukki Arch Dam",
		RiverName:        "Periyar River Corridor",
		State:            "Kerala",
		Event:            "Idukki Arch Dam Gorge Surge",
		ReachKm:          85.0,
		MaxDepthM:        26.2,
		PeakDischargeM3s: 28500.0,
		FloodedAreaKm2:   64.2,
		Coords: [][2]float64{
			{76.9744, 9.8517},
			{76.9620, 9.8700},
			{76.9050, 9.9120},
			{76.7820, 10.0540},
			{76.6210, 10.0630},
			{76.3540, 10.1080},
			{76.3400, 10.1300},
			{76.6100, 10.0800},
			{76.7700, 10.0700},
			{76.9744, 9.8517},
		},
		Stations: []StationExport{
			{Name: "Cheruthoni Gorge Toe", ChainageKm: 0.0, PeakDepthM: 26.2, ArrivalMin: 0, Coords: [2]float64{76.9744, 9.8517}, Severity: "CRITICAL"},
			{Name: "Neriamangalam Bridge", ChainageKm: 28.0, PeakDepthM: 18.5, ArrivalMin: 32, Coords: [2]float64{76.9050, 9.9120}, Severity: "EXTREME"},
			{Name: "Bhoothathankettu Barrage", ChainageKm: 48.0, PeakDepthM: 13.2, ArrivalMin: 62, Coords: [2]float64{76.7820, 10.0540}, Severity: "HIGH"},
			{Name: "Kalady Temple Reach", ChainageKm: 68.0, PeakDepthM: 8.4, ArrivalMin: 105, Coords: [2]float64{76.6210, 10.0630}, Severity: "MODERATE"},
			{Name: "Aluva Plain Confluence", ChainageKm: 85.0, PeakDepthM: 4.6, ArrivalMin: 150, Coords: [2]float64{76.3540, 10.1080}, Severity: "MODERATE"},
		},
	},
}

func GetExportProfile(runID string, optCaseID ...string) ExportProfile {
	if len(optCaseID) > 0 && optCaseID[0] != "" {
		c := strings.ToLower(optCaseID[0])
		if p, ok := Profiles[c]; ok {
			return p
		}
		for k, p := range Profiles {
			if strings.Contains(c, strings.ReplaceAll(k, "-dam", "")) {
				return p
			}
		}
	}

	lowerRun := strings.ToLower(runID)
	if strings.Contains(lowerRun, "sardar") || strings.Contains(lowerRun, "narmada") {
		return Profiles["sardar-sarovar-dam"]
	} else if strings.Contains(lowerRun, "bhakra") || strings.Contains(lowerRun, "satluj") {
		return Profiles["bhakra-dam"]
	} else if strings.Contains(lowerRun, "idukki") || strings.Contains(lowerRun, "periyar") {
		return Profiles["idukki-dam"]
	}

	return Profiles["tehri-dam"]
}

func GenerateKML(runID string, optCaseID ...string) []byte {
	prof := GetExportProfile(runID, optCaseID...)

	var coordStrs []string
	for _, pt := range prof.Coords {
		coordStrs = append(coordStrs, fmt.Sprintf("%.4f,%.4f,0", pt[0], pt[1]))
	}
	coordBlock := strings.Join(coordStrs, " ")

	var placemarks []string
	for _, st := range prof.Stations {
		placemarks = append(placemarks, fmt.Sprintf(`    <Placemark>
      <name>%s (Chainage %.1f km)</name>
      <description>Peak Flood Depth: %.1fm | Arrival Time: %d min | Severity: %s</description>
      <Point><coordinates>%.4f,%.4f,0</coordinates></Point>
    </Placemark>`, st.Name, st.ChainageKm, st.PeakDepthM, st.ArrivalMin, st.Severity, st.Coords[0], st.Coords[1]))
	}

	kml := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Jalrekha Flood Extent - %s</name>
    <description>Dam-break flood wave boundary and downstream impact points along the %.0f km %s corridor (%s, EPSG:4326).</description>
    <Style id="floodPoly">
      <LineStyle><color>ffea580c</color><width>2</width></LineStyle>
      <PolyStyle><color>7fea580c</color></PolyStyle>
    </Style>
    <Placemark>
      <name>%s Inundation Footprint</name>
      <styleUrl>#floodPoly</styleUrl>
      <Polygon>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              %s
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
%s
  </Document>
</kml>`, runID, prof.ReachKm, prof.RiverName, prof.State, prof.DamName, coordBlock, strings.Join(placemarks, "\n"))

	return []byte(kml)
}

func GenerateGeoJSON(runID string, optCaseID ...string) []byte {
	prof := GetExportProfile(runID, optCaseID...)

	var polyCoordPairs []string
	for _, pt := range prof.Coords {
		polyCoordPairs = append(polyCoordPairs, fmt.Sprintf("[%.4f, %.4f]", pt[0], pt[1]))
	}

	var stationFeatures []string
	for _, st := range prof.Stations {
		feat := fmt.Sprintf(`    {
      "type": "Feature",
      "properties": {
        "name": "%s",
        "chainage_km": %.1f,
        "peak_depth_m": %.1f,
        "arrival_min": %d,
        "severity": "%s"
      },
      "geometry": { "type": "Point", "coordinates": [%.4f, %.4f] }
    }`, st.Name, st.ChainageKm, st.PeakDepthM, st.ArrivalMin, st.Severity, st.Coords[0], st.Coords[1])
		stationFeatures = append(stationFeatures, feat)
	}

	geo := fmt.Sprintf(`{
  "type": "FeatureCollection",
  "name": "jalrekha_flood_extent_%s",
  "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "run_id": "%s",
        "case_id": "%s",
        "dam_name": "%s",
        "river": "%s",
        "solver": "Delft3D-FM / DualSPHysics",
        "event": "%s",
        "max_depth_m": %.1f,
        "peak_discharge_m3s": %.1f,
        "area_sqkm": %.1f
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          %s
        ]]
      }
    }%s%s
  ]
}`, runID, runID, prof.CaseID, prof.DamName, prof.RiverName, prof.Event, prof.MaxDepthM, prof.PeakDischargeM3s, prof.FloodedAreaKm2,
		strings.Join(polyCoordPairs, ", "),
		func() string {
			if len(stationFeatures) > 0 {
				return ",\n"
			}
			return ""
		}(),
		strings.Join(stationFeatures, ",\n"))

	return []byte(geo)
}

func GenerateShapefileZIP(runID string, optCaseID ...string) ([]byte, error) {
	prof := GetExportProfile(runID, optCaseID...)

	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	prjContent := `GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]`
	fPrj, err := zipWriter.Create(fmt.Sprintf("%s.prj", runID))
	if err != nil {
		return nil, err
	}
	_, _ = fPrj.Write([]byte(prjContent))

	readmeContent := fmt.Sprintf(`Jalrekha ESRI Shapefile Export Bundle
Run ID: %s
Dam: %s (%s, %s)
Reach Corridor: %.0f km
Timestamp: %s
Projection: EPSG:4326 (WGS 84 Geographic 2D)
Contents:
- %s.shp: Flood extent boundary polygon (ESRI Shapefile Type 5: Polygon)
- %s.shx: Shapefile index record table
- %s.dbf: dBase III attribute table (RUN_ID, EVENT, MAX_DEPTH, PEAK_Q, AREA_KM2, SEVERITY)
- %s.prj: Coordinate Reference System Well-Known Text (EPSG:4326)
Consumable by QGIS, ArcGIS, GDAL/OGR, and Python GeoPandas.
`, runID, prof.DamName, prof.RiverName, prof.State, prof.ReachKm, time.Now().UTC().Format(time.RFC3339), runID, runID, runID, runID)

	fTxt, _ := zipWriter.Create("README.txt")
	_, _ = fTxt.Write([]byte(readmeContent))

	shpBytes, shxBytes := buildESRIPolygonSHP(prof.Coords)
	dbfBytes := buildESRIDBF(runID, prof.Event, prof.MaxDepthM, prof.PeakDischargeM3s, prof.FloodedAreaKm2, "CRITICAL")

	fShp, _ := zipWriter.Create(fmt.Sprintf("%s.shp", runID))
	_, _ = fShp.Write(shpBytes)

	fShx, _ := zipWriter.Create(fmt.Sprintf("%s.shx", runID))
	_, _ = fShx.Write(shxBytes)

	fDbf, _ := zipWriter.Create(fmt.Sprintf("%s.dbf", runID))
	_, _ = fDbf.Write(dbfBytes)

	_ = zipWriter.Close()
	return buf.Bytes(), nil
}

// EnsureClockwise enforces that polygon outer rings follow a clockwise winding order
// with a closed vertex loop, as strictly mandated by the ESRI Shapefile Technical
// Description (July 1998, p. 8).
func EnsureClockwise(coords [][2]float64) [][2]float64 {
	if len(coords) < 3 {
		return coords
	}
	pts := make([][2]float64, len(coords))
	copy(pts, coords)

	// Ensure closed ring (first vertex == last vertex)
	n := len(pts)
	if pts[0][0] != pts[n-1][0] || pts[0][1] != pts[n-1][1] {
		pts = append(pts, pts[0])
		n = len(pts)
	}

	// Calculate signed area using the Shoelace formula:
	// In standard geographic coordinates (X = lon, Y = lat):
	// signedArea > 0 is Counter-Clockwise (CCW).
	// signedArea < 0 is Clockwise (CW).
	var signedArea float64
	for i := 0; i < n-1; i++ {
		signedArea += (pts[i][0] * pts[i+1][1]) - (pts[i+1][0] * pts[i][1])
	}

	// If CCW, reverse the vertices to make the outer ring Clockwise
	if signedArea > 0 {
		for i, j := 0, n-1; i < j; i, j = i+1, j-1 {
			pts[i], pts[j] = pts[j], pts[i]
		}
	}
	return pts
}

func buildESRIPolygonSHP(rawCoords [][2]float64) ([]byte, []byte) {
	coords := EnsureClockwise(rawCoords)
	minX, maxX := coords[0][0], coords[0][0]
	minY, maxY := coords[0][1], coords[0][1]
	for _, pt := range coords {
		if pt[0] < minX {
			minX = pt[0]
		}
		if pt[0] > maxX {
			maxX = pt[0]
		}
		if pt[1] < minY {
			minY = pt[1]
		}
		if pt[1] > maxY {
			maxY = pt[1]
		}
	}

	numPoints := int32(len(coords))
	contentBytesLen := 4 + 32 + 4 + 4 + 4 + int(numPoints)*16
	contentWordsLen := int32(contentBytesLen / 2)

	totalShpWords := int32(50 + 4 + contentWordsLen)
	totalShxWords := int32(50 + 4)

	shpBuf := new(bytes.Buffer)
	writeShapeHeader(shpBuf, totalShpWords, 5, minX, minY, maxX, maxY)
	_ = binary.Write(shpBuf, binary.BigEndian, int32(1))
	_ = binary.Write(shpBuf, binary.BigEndian, contentWordsLen)
	_ = binary.Write(shpBuf, binary.LittleEndian, int32(5))
	_ = binary.Write(shpBuf, binary.LittleEndian, minX)
	_ = binary.Write(shpBuf, binary.LittleEndian, minY)
	_ = binary.Write(shpBuf, binary.LittleEndian, maxX)
	_ = binary.Write(shpBuf, binary.LittleEndian, maxY)
	_ = binary.Write(shpBuf, binary.LittleEndian, int32(1))
	_ = binary.Write(shpBuf, binary.LittleEndian, numPoints)
	_ = binary.Write(shpBuf, binary.LittleEndian, int32(0))
	for _, pt := range coords {
		_ = binary.Write(shpBuf, binary.LittleEndian, pt[0])
		_ = binary.Write(shpBuf, binary.LittleEndian, pt[1])
	}

	shxBuf := new(bytes.Buffer)
	writeShapeHeader(shxBuf, totalShxWords, 5, minX, minY, maxX, maxY)
	_ = binary.Write(shxBuf, binary.BigEndian, int32(50))
	_ = binary.Write(shxBuf, binary.BigEndian, contentWordsLen)

	return shpBuf.Bytes(), shxBuf.Bytes()
}

func writeShapeHeader(buf *bytes.Buffer, fileLengthWords int32, shapeType int32, minX, minY, maxX, maxY float64) {
	_ = binary.Write(buf, binary.BigEndian, int32(9994))
	for i := 0; i < 5; i++ {
		_ = binary.Write(buf, binary.BigEndian, int32(0))
	}
	_ = binary.Write(buf, binary.BigEndian, fileLengthWords)
	_ = binary.Write(buf, binary.LittleEndian, int32(1000))
	_ = binary.Write(buf, binary.LittleEndian, shapeType)
	_ = binary.Write(buf, binary.LittleEndian, minX)
	_ = binary.Write(buf, binary.LittleEndian, minY)
	_ = binary.Write(buf, binary.LittleEndian, maxX)
	_ = binary.Write(buf, binary.LittleEndian, maxY)
	for i := 0; i < 4; i++ {
		_ = binary.Write(buf, binary.LittleEndian, float64(0.0))
	}
}

func buildESRIDBF(runID, event string, maxDepth, peakQ, areaKm2 float64, severity string) []byte {
	buf := new(bytes.Buffer)
	now := time.Now().UTC()
	year := byte(now.Year() - 1900)
	month := byte(now.Month())
	day := byte(now.Day())

	buf.WriteByte(0x03)
	buf.WriteByte(year)
	buf.WriteByte(month)
	buf.WriteByte(day)
	_ = binary.Write(buf, binary.LittleEndian, uint32(1))
	_ = binary.Write(buf, binary.LittleEndian, uint16(32+6*32+1))
	_ = binary.Write(buf, binary.LittleEndian, uint16(101))
	buf.Write(make([]byte, 20))

	writeDBFField(buf, "RUN_ID", 'C', 24, 0)
	writeDBFField(buf, "EVENT", 'C', 32, 0)
	writeDBFField(buf, "MAX_DEPTH", 'N', 10, 2)
	writeDBFField(buf, "PEAK_Q", 'N', 12, 1)
	writeDBFField(buf, "AREA_KM2", 'N', 10, 2)
	writeDBFField(buf, "SEVERITY", 'C', 12, 0)

	buf.WriteByte(0x0D)

	buf.WriteByte(0x20)
	writePaddedString(buf, runID, 24)
	writePaddedString(buf, event, 32)
	writePaddedString(buf, fmt.Sprintf("%10.2f", maxDepth), 10)
	writePaddedString(buf, fmt.Sprintf("%12.1f", peakQ), 12)
	writePaddedString(buf, fmt.Sprintf("%10.2f", areaKm2), 10)
	writePaddedString(buf, severity, 12)

	buf.WriteByte(0x1A)

	return buf.Bytes()
}

func writeDBFField(buf *bytes.Buffer, name string, fType byte, length byte, decimals byte) {
	var fieldBytes [11]byte
	copy(fieldBytes[:], name)
	buf.Write(fieldBytes[:])
	buf.WriteByte(fType)
	buf.Write(make([]byte, 4))
	buf.WriteByte(length)
	buf.WriteByte(decimals)
	buf.Write(make([]byte, 14))
}

func writePaddedString(buf *bytes.Buffer, s string, length int) {
	if len(s) > length {
		s = s[:length]
	}
	buf.WriteString(s)
	if pad := length - len(s); pad > 0 {
		buf.WriteString(strings.Repeat(" ", pad))
	}
}

// GenerateExecutiveReport delegates to the dedicated reportgen package for tactical EAP briefings.
func GenerateExecutiveReport(runID string, optCaseID ...string) []byte {
	return reportgen.GenerateExecutiveReport(runID, optCaseID...)
}
