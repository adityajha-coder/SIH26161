# DualSPHysics SPH Engine

## 1. Pinned Source Revision & Formulation

- **Software Suite**: DualSPHysics (Smoothed Particle Hydrodynamics)
- **Version**: DualSPHysics v5.2 (CUDA GPU & OpenMP CPU)
- **Governing Equations**: Navier-Stokes equations in Lagrangian SPH formulation with Weakly Compressible SPH (WCSPH)
- **Kernel Function**: Wendland quintic kernel ($C^2$) with smoothing length $h = 1.5 \cdot dp$
- **Equation of State**: Tait's equation of state with artificial sound speed $c_0 \ge 10 \cdot v_{max}$ ensuring density variations $\le 1\%$
- **Boundary Handling**: Modified Dynamic Boundary Conditions (mDBC) on 3D terrain mesh derived from `data/processed/tehri_domain.asc`

## 2. Docker Container Build & Benchmark

To build the container image:

```bash
cd engines/sph
docker build -t sih26161/dualsphysics:5.2 .
```

To run the benchmark flume dam-break test (Gómez-Gesteira et al. 2010):

```bash
docker run --rm sih26161/dualsphysics:5.2 --benchmark
```

## 3. Domain Reduction Strategy

Because Lagrangian SPH requires fine spatial resolution to resolve complex 3D free surface overturning, splashup, and plunge pool wave formation, DualSPHysics is focused on:
1. **Near-field domain**: From reservoir crest through the dam breach chute to downstream km 25 (past Koteshwar Dam).
2. **Coupling / Grid Mapping**: `PartVTK` and `IsoSurface` interpolate particle field outputs to the common 30m UTM 44N raster grid for direct cell-by-cell comparison with Delft3D FM Eulerian SWE.
