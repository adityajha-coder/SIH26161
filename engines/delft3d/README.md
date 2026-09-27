# Delft3D FM (D-Flow FM) Engine

## 1. Pinned Source Revision & Environment

- **Software Suite**: Deltares Delft3D Flexible Mesh Suite (Delft3D FM)
- **Kernel Version**: D-Flow FM v1.2.140 (Source tag `delft3dfm_2023.03`)
- **Governing Equations**: 2D Depth-Averaged Shallow Water Equations (SWE) with non-hydrostatic pressure correction
- **Advection Scheme**: Perot (1998) momentum-conserving scheme
- **Time Stepping**: Semi-implicit, adaptive time stepping governed by Courant-Friedrichs-Lewy ($CFL \le 0.7$)

## 2. Docker Container Build

To build the container image locally:

```bash
cd engines/delft3d
docker build -t sih26161/delft3d-fm:2023.03 .
```

To run the Ritter benchmark dam-break flume verification:

```bash
docker run --rm sih26161/delft3d-fm:2023.03 --benchmark
```

## 3. Solver Input Configuration (`.mdu`)

The simulation worker converts Scenario JSON into the standard D-Flow FM input structure:

```
workspace/
├── run.mdu               # Master Definition File (physics, time steps, output intervals)
├── flow2d.net            # Unstructured mesh definition
├── bathymetry.xyz        # Terrain elevation points from data/processed/tehri_delft3d.xyz
├── boundary.ext          # External forcings definition
├── breach_inflow.bc      # Time-discharge hydrograph Q(t) from Froehlich empirical calculation
└── roughness.xyz         # Spatial Manning roughness (channel: 0.035, floodplain: 0.065)
```

## 4. Verification & Milestone Progress

The runner emits deterministic JSON progress events on stdout:
- `[INITIALISING] 5%`
- `[PREPARING] 15%`
- `[BOUNDARY] 25%`
- `[RUNNING] 50%`
- `[RUNNING] 75%`
- `[POSTPROCESSING] 90%`
- `[DONE] 100%`

GeoTIFF outputs are written to `workspace/output/` and registered into the PostgreSQL database under `result_layers`.
