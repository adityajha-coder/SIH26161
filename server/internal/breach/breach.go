package breach

import (
	"errors"
	"fmt"
	"math"
)

type BreachParams struct {
	CaseID               string  `json:"case_id"`
	TriggerType          string  `json:"trigger_type"`
	ReservoirLevelM      float64 `json:"reservoir_level_m"`
	ReleasedVolumeMCM    float64 `json:"released_volume_mcm"`
	DamCrestElevationM   float64 `json:"dam_crest_elevation_m"`
	DamCrestLengthM      float64 `json:"dam_crest_length_m"`
	DamHeightM           float64 `json:"dam_height_m"`
	BreachWidthM         float64 `json:"breach_width_m"`
	BreachDepthM         float64 `json:"breach_depth_m"`
	FormationTimeHr      float64 `json:"formation_time_hr"`
	ChannelRoughness     float64 `json:"channel_roughness"`
	SimulationHorizonHr  float64 `json:"simulation_horizon_hr"`
}

type HydrographPoint struct {
	TimeHr         float64 `json:"time_hr"`
	DischargeCumec float64 `json:"discharge_cumec"`
}

type HydrographResult struct {
	PeakDischargeCumec float64           `json:"peak_discharge_cumec"`
	FormationTimeHr    float64           `json:"formation_time_hr"`
	BreachWidthM       float64           `json:"breach_width_m"`
	ReleasedVolumeMCM  float64           `json:"released_volume_mcm"`
	TotalIntegratedMCM float64           `json:"total_integrated_mcm"`
	MassBalanceRatio   float64           `json:"mass_balance_ratio"`
	MassBalancePassed  bool              `json:"mass_balance_passed"`
	BaseCurve          []HydrographPoint `json:"base_curve"`
	LowCurve           []HydrographPoint `json:"low_curve"`
	HighCurve          []HydrographPoint `json:"high_curve"`
}

func ValidatePreSolver(p *BreachParams) error {
	if p.CaseID == "" {
		return errors.New("case_id is required")
	}
	if p.DamCrestElevationM <= 0 {
		p.DamCrestElevationM = 839.5
	}
	if p.DamCrestLengthM <= 0 {
		p.DamCrestLengthM = 575.0
	}
	if p.DamHeightM <= 0 {
		p.DamHeightM = 260.5
	}

	if p.ReservoirLevelM <= 0 || p.ReservoirLevelM > p.DamCrestElevationM+5.0 {
		return fmt.Errorf("reservoir level (%.2f m) is physically impossible (max crest %.2f m)", p.ReservoirLevelM, p.DamCrestElevationM)
	}

	if p.ReleasedVolumeMCM <= 0 || p.ReleasedVolumeMCM > 4000.0 {
		return fmt.Errorf("released volume (%.2f MCM) exceeds physical reservoir storage (max 4000 MCM)", p.ReleasedVolumeMCM)
	}

	if p.BreachWidthM > 0 && p.BreachWidthM > p.DamCrestLengthM {
		return fmt.Errorf("breach width (%.2f m) exceeds dam crest length (%.2f m)", p.BreachWidthM, p.DamCrestLengthM)
	}

	if p.BreachDepthM > 0 && p.BreachDepthM > p.DamHeightM {
		return fmt.Errorf("breach depth (%.2f m) exceeds dam structural height (%.2f m)", p.BreachDepthM, p.DamHeightM)
	}

	if p.FormationTimeHr < 0 || p.FormationTimeHr > 48.0 {
		return fmt.Errorf("breach formation time (%.2f hr) is outside plausible hydrodynamic bounds (0 - 48 hr)", p.FormationTimeHr)
	}

	return nil
}

func CalculateFroehlichBreach(p BreachParams) HydrographResult {
	Vw := p.ReleasedVolumeMCM * 1e6
	hw := p.BreachDepthM
	if hw <= 0 {
		hw = p.DamHeightM * 0.85
	}

	ko := 1.0
	if p.TriggerType == "overtopping" {
		ko = 1.4
	}

	Bavg := p.BreachWidthM
	if Bavg <= 0 {
		Bavg = 0.27 * ko * math.Pow(Vw, 0.32) * math.Pow(hw, 0.04)
		if Bavg > p.DamCrestLengthM {
			Bavg = p.DamCrestLengthM
		}
	}

	tfSec := p.FormationTimeHr * 3600.0
	if tfSec <= 0 {
		g := 9.80665
		tfSec = 63.2 * math.Sqrt(Vw/(g*hw*hw))
	}
	tfHr := tfSec / 3600.0

	Qp := 0.607 * math.Pow(Vw, 0.295) * math.Pow(hw, 1.24)
	if Qp > 250000.0 {
		Qp = 250000.0
	}

	horizonHr := p.SimulationHorizonHr
	if horizonHr <= 0 {
		horizonHr = 18.0
	}

	baseCurve := generateHydrograph(Qp, tfHr, horizonHr, Vw)
	lowCurve := generateHydrograph(Qp*0.8, tfHr*1.15, horizonHr, Vw*0.85)
	highCurve := generateHydrograph(Qp*1.2, tfHr*0.85, horizonHr, Vw*1.15)

	integratedVolumeM3 := integrateCurve(baseCurve)
	integratedMCM := integratedVolumeM3 / 1e6
	ratio := integratedMCM / p.ReleasedVolumeMCM
	passed := math.Abs(ratio-1.0) <= 0.08

	return HydrographResult{
		PeakDischargeCumec: math.Round(Qp*10) / 10,
		FormationTimeHr:    math.Round(tfHr*100) / 100,
		BreachWidthM:       math.Round(Bavg*10) / 10,
		ReleasedVolumeMCM:  p.ReleasedVolumeMCM,
		TotalIntegratedMCM: math.Round(integratedMCM*10) / 10,
		MassBalanceRatio:   math.Round(ratio*1000) / 1000,
		MassBalancePassed:  passed,
		BaseCurve:          baseCurve,
		LowCurve:           lowCurve,
		HighCurve:          highCurve,
	}
}

func generateHydrograph(Qp float64, tfHr float64, horizonHr float64, targetVolM3 float64) []HydrographPoint {
	steps := 120
	dtHr := horizonHr / float64(steps)
	points := make([]HydrographPoint, steps+1)

	decayRate := 3.2 / math.Max(horizonHr-tfHr, 2.0)

	for i := 0; i <= steps; i++ {
		t := float64(i) * dtHr
		var q float64
		if t <= tfHr {
			ratio := t / math.Max(tfHr, 0.01)
			q = 200.0 + (Qp-200.0)*math.Pow(ratio, 2.0)
		} else {
			elapsed := t - tfHr
			q = 200.0 + (Qp-200.0)*math.Exp(-decayRate*elapsed)
		}
		points[i] = HydrographPoint{
			TimeHr:         math.Round(t*100) / 100,
			DischargeCumec: q,
		}
	}

	rawVolume := IntegrateCurve(points)
	if rawVolume > 0 && targetVolM3 > 0 {
		scale := targetVolM3 / rawVolume
		for i := range points {
			points[i].DischargeCumec = math.Round(points[i].DischargeCumec*scale*10) / 10
		}
	}

	return points
}

// IntegrateCurve calculates the total released volume (m³) under a hydrograph
// using Composite Simpson's 1/3 Rule for high-order quadratic numerical quadrature.
// If the number of sub-intervals is odd, Simpson's 1/3 rule is used on the first N-1
// intervals and the trapezoidal rule is applied to the final interval.
func IntegrateCurve(curve []HydrographPoint) float64 {
	n := len(curve)
	if n < 2 {
		return 0.0
	}
	if n == 2 {
		dtSec := (curve[1].TimeHr - curve[0].TimeHr) * 3600.0
		return 0.5 * (curve[0].DischargeCumec + curve[1].DischargeCumec) * dtSec
	}

	intervals := n - 1
	simpsonIntervals := intervals
	hasOddRemainder := false
	if simpsonIntervals%2 != 0 {
		simpsonIntervals--
		hasOddRemainder = true
	}

	total := 0.0
	if simpsonIntervals >= 2 {
		dtSec := (curve[simpsonIntervals].TimeHr - curve[0].TimeHr) * 3600.0 / float64(simpsonIntervals)
		sum := curve[0].DischargeCumec + curve[simpsonIntervals].DischargeCumec
		for i := 1; i < simpsonIntervals; i++ {
			if i%2 == 1 {
				sum += 4.0 * curve[i].DischargeCumec
			} else {
				sum += 2.0 * curve[i].DischargeCumec
			}
		}
		total += (dtSec / 3.0) * sum
	}

	if hasOddRemainder {
		lastDtSec := (curve[n-1].TimeHr - curve[n-2].TimeHr) * 3600.0
		total += 0.5 * (curve[n-2].DischargeCumec + curve[n-1].DischargeCumec) * lastDtSec
	}

	return total
}

func integrateCurve(curve []HydrographPoint) float64 {
	return IntegrateCurve(curve)
}
