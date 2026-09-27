package worker

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/sih26161/backend/internal/breach"
)

func TestDelft3DConfigGeneration(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewSimulationWorker(nil, nil, nil, tmpDir)

	p := breach.BreachParams{
		CaseID:              "tehri-dam",
		TriggerType:         "overtopping",
		ReservoirLevelM:     830.0,
		ReleasedVolumeMCM:   2100.0,
		DamCrestElevationM:  839.5,
		DamCrestLengthM:     575.0,
		DamHeightM:          260.5,
		BreachWidthM:        220.0,
		BreachDepthM:        140.0,
		FormationTimeHr:     2.5,
		SimulationHorizonHr: 18.0,
	}

	mduPath, err := w.generateDelft3DConfig(tmpDir, p)
	if err != nil {
		t.Fatalf("failed to generate Delft3D config: %v", err)
	}

	if _, err := os.Stat(mduPath); os.IsNotExist(err) {
		t.Fatalf("expected run.mdu to exist at %s", mduPath)
	}

	bcPath := filepath.Join(tmpDir, "breach_inflow.bc")
	if _, err := os.Stat(bcPath); os.IsNotExist(err) {
		t.Fatalf("expected breach_inflow.bc to exist at %s", bcPath)
	}
}

func TestSimulationWorkerExecution(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewSimulationWorker(nil, nil, nil, tmpDir)

	runID := "test-run-delft3d-001"
	scenarioID := "scen-baseline-pmf"

	err := w.ExecuteRun(runID, scenarioID, "delft3d")
	if err != nil {
		t.Fatalf("simulation worker execution failed: %v", err)
	}

	// Verify run workspace output summary exists
	summaryFile := filepath.Join(tmpDir, runID, "output", "simulation_summary.json")
	if _, err := os.Stat(summaryFile); os.IsNotExist(err) {
		t.Fatalf("expected simulation_summary.json to exist at %s", summaryFile)
	}
}

func TestDualSPHysicsExecution(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewSimulationWorker(nil, nil, nil, tmpDir)

	runID := "test-run-dualsphysics-001"
	scenarioID := "scen-baseline-pmf"

	err := w.ExecuteRun(runID, scenarioID, "dualsphysics")
	if err != nil {
		t.Fatalf("DualSPHysics worker execution failed: %v", err)
	}

	summaryFile := filepath.Join(tmpDir, runID, "output", "simulation_summary.json")
	if _, err := os.Stat(summaryFile); os.IsNotExist(err) {
		t.Fatalf("expected simulation_summary.json for DualSPHysics to exist at %s", summaryFile)
	}
}

