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
