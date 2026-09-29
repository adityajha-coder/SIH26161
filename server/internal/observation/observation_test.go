package observation

import (
	"testing"
)

func TestGetLatestObservations(t *testing.T) {
	products := GetLatestObservations("tehri-dam")

	if len(products) < 3 {
		t.Fatalf("expected at least 3 satellite products, got %d", len(products))
	}

	for _, p := range products {
		if p.SourceID == "" || p.Platform == "" || p.SceneID == "" {
			t.Errorf("product missing mandatory metadata: %+v", p)
		}
		if p.DataAgeHours < 0 {
			t.Errorf("negative data age: %f", p.DataAgeHours)
		}
		if p.Freshness == "" {
			t.Errorf("missing freshness state: %+v", p)
		}
	}
}

func TestGetRishiGangaObservations(t *testing.T) {
	products := GetLatestObservations("rishi-ganga")

	if len(products) != 3 {
		t.Fatalf("expected 3 products for rishi-ganga, got %d", len(products))
	}

	var hasS1, hasS2, hasDEM bool
	for _, p := range products {
		if p.SourceID == "sentinel-1-grd" {
			hasS1 = true
			if p.ResolutionM != 10.0 {
				t.Errorf("expected 10.0m Sentinel-1 resolution, got %f", p.ResolutionM)
			}
		}
		if p.SourceID == "sentinel-2-msi" {
			hasS2 = true
			if p.ResolutionM != 10.0 {
				t.Errorf("expected 10.0m Sentinel-2 resolution, got %f", p.ResolutionM)
			}
		}
		if p.SourceID == "copernicus-glo30-dem" {
			hasDEM = true
		}
	}

	if !hasS1 || !hasS2 || !hasDEM {
		t.Errorf("expected S1, S2, and DEM products for rishi-ganga, got s1=%v, s2=%v, dem=%v", hasS1, hasS2, hasDEM)
	}
}

func TestRefreshObservations(t *testing.T) {
	worker := NewObservationWorker(nil, nil)
	products := worker.RefreshObservations("rishi-ganga")
	if len(products) < 3 {
		t.Errorf("expected at least 3 products from RefreshObservations, got %d", len(products))
	}
}
