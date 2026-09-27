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
