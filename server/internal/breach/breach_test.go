package breach

import (
	"math"
	"testing"
)

func TestValidatePreSolver(t *testing.T) {
	valid := BreachParams{
		CaseID:             "tehri-dam",
		TriggerType:        "overtopping",
		ReservoirLevelM:    830.0,
		ReleasedVolumeMCM:  2600.0,
		DamCrestElevationM: 839.5,
		DamCrestLengthM:    575.0,
		DamHeightM:         260.5,
		BreachWidthM:       220.0,
		BreachDepthM:       140.0,
		FormationTimeHr:    2.5,
	}

	if err := ValidatePreSolver(&valid); err != nil {
		t.Fatalf("expected valid params, got error: %v", err)
	}

	invalidLevel := valid
	invalidLevel.ReservoirLevelM = 900.0
	if err := ValidatePreSolver(&invalidLevel); err == nil {
		t.Fatalf("expected error for reservoir level exceeding crest, got nil")
	}

	invalidVolume := valid
	invalidVolume.ReleasedVolumeMCM = 5000.0
	if err := ValidatePreSolver(&invalidVolume); err == nil {
		t.Fatalf("expected error for volume exceeding 4000 MCM, got nil")
	}

	invalidWidth := valid
	invalidWidth.BreachWidthM = 800.0
	if err := ValidatePreSolver(&invalidWidth); err == nil {
		t.Fatalf("expected error for breach width exceeding crest length, got nil")
	}
}

func TestCalculateFroehlichBreachAndMassBalance(t *testing.T) {
	p := BreachParams{
		CaseID:              "tehri-dam",
		TriggerType:         "overtopping",
		ReservoirLevelM:     830.0,
		ReleasedVolumeMCM:   2100.0,
		DamCrestElevationM:  839.5,
		DamCrestLengthM:     575.0,
		DamHeightM:          260.5,
		BreachWidthM:        240.0,
		BreachDepthM:        150.0,
		FormationTimeHr:     2.8,
		SimulationHorizonHr: 18.0,
	}

	res := CalculateFroehlichBreach(p)

	if res.PeakDischargeCumec <= 0 {
		t.Errorf("peak discharge should be > 0, got %f", res.PeakDischargeCumec)
	}

	if !res.MassBalancePassed {
		t.Errorf("mass balance failed: target %f MCM, integrated %f MCM, ratio %f",
			res.ReleasedVolumeMCM, res.TotalIntegratedMCM, res.MassBalanceRatio)
	}

	if math.Abs(res.MassBalanceRatio-1.0) > 0.05 {
		t.Errorf("mass balance ratio should be within 5%% of 1.0, got %f", res.MassBalanceRatio)
	}

	if len(res.BaseCurve) == 0 || len(res.LowCurve) == 0 || len(res.HighCurve) == 0 {
		t.Errorf("expected sensitivity curves to be populated")
	}
}

func TestIntegrateCurveSimpsonsRule(t *testing.T) {
	// Verify exact integration of quadratic polynomial:
	// Q(t) = 3000 * t^2  [m3/s], t in [0, 1] hours (0 to 3600 seconds)
	// Analytical integral over time (sec):
	// ∫_{0}^{3600} 3000 * (t/3600)^2 dt = 3000 * 3600 / 3 = 3,600,000 m3
	n := 120 // Even sub-intervals
	curve := make([]HydrographPoint, n+1)
	for i := 0; i <= n; i++ {
		tHr := float64(i) / float64(n)
		curve[i] = HydrographPoint{
			TimeHr:         tHr,
			DischargeCumec: 3000.0 * tHr * tHr,
		}
	}

	volM3 := IntegrateCurve(curve)
	expectedM3 := 3000.0 * 3600.0 / 3.0 // 3.6e6 m3

	relativeError := math.Abs(volM3-expectedM3) / expectedM3
	if relativeError > 1e-6 {
		t.Errorf("Simpson's 1/3 rule should integrate quadratics exactly (<1e-6 error), got error: %e (vol: %f, exp: %f)",
			relativeError, volM3, expectedM3)
	}
}

func TestDamTypeBreachBranching(t *testing.T) {
	// 1. Rockfill Dam (Tehri)
	pRock := BreachParams{
		CaseID:            "tehri-dam",
		DamType:           "rockfill",
		TriggerType:       "overtopping",
		ReservoirLevelM:   830.0,
		ReleasedVolumeMCM: 2100.0,
		DamHeightM:        260.5,
		DamCrestLengthM:   575.0,
	}
	resRock := CalculateBreachHydrograph(pRock)
	if resRock.DamType != "rockfill" {
		t.Errorf("expected rockfill dam type, got %s", resRock.DamType)
	}
	if resRock.FormationTimeHr < 1.0 {
		t.Errorf("rockfill dam should have progressive formation time (>1.0 hr), got %f", resRock.FormationTimeHr)
	}
	if !resRock.MassBalancePassed {
		t.Errorf("mass balance failed for rockfill dam")
	}

	// 2. Concrete Gravity Dam (Sardar Sarovar)
	pGravity := BreachParams{
		CaseID:            "sardar-sarovar-dam",
		DamType:           "concrete_gravity",
		TriggerType:       "overtopping",
		ReservoirLevelM:   138.68,
		ReleasedVolumeMCM: 1500.0,
		DamHeightM:        163.0,
		DamCrestLengthM:   1210.0,
	}
	resGravity := CalculateBreachHydrograph(pGravity)
	if resGravity.DamType != "concrete_gravity" {
		t.Errorf("expected concrete_gravity dam type, got %s", resGravity.DamType)
	}
	if resGravity.FormationTimeHr > 0.5 {
		t.Errorf("concrete gravity monolith failure should be rapid (<=0.5 hr), got %f", resGravity.FormationTimeHr)
	}
	if !resGravity.MassBalancePassed {
		t.Errorf("mass balance failed for concrete gravity dam")
	}

	// 3. Concrete Arch Dam (Idukki)
	pArch := BreachParams{
		CaseID:            "idukki-dam",
		DamType:           "concrete_arch",
		TriggerType:       "overtopping",
		ReservoirLevelM:   732.43,
		ReleasedVolumeMCM: 800.0,
		DamHeightM:        168.9,
		DamCrestLengthM:   365.9,
	}
	resArch := CalculateBreachHydrograph(pArch)
	if resArch.DamType != "concrete_arch" {
		t.Errorf("expected concrete_arch dam type, got %s", resArch.DamType)
	}
	if resArch.FormationTimeHr > 0.15 {
		t.Errorf("concrete arch cantilever fracture should be near instantaneous (<=0.15 hr), got %f", resArch.FormationTimeHr)
	}
	if !resArch.MassBalancePassed {
		t.Errorf("mass balance failed for concrete arch dam")
	}
}
