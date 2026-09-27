# Solver Fallback Architecture — LISFLOOD-FP

## 1. Rationale & Purpose

The primary Eulerian hydrodynamic solver in Jalrekha is **Delft3D FM (D-Flow FM)**, operating on flexible unstructured meshes. To ensure extreme operational reliability across heterogeneous compute environments (e.g. edge deployments without MPI or environments where Fortran/C++ shared libraries cannot be compiled), the platform provides a native fallback solver: **LISFLOOD-FP**.

## 2. Integrity & Honest Labelling Principle

Per Master Rule §1 of the SIH26161 Specification:
- **No Mock or Mislabelled Solvers**: If LISFLOOD-FP is invoked, all metadata, log outputs, API responses, database records, and UI badges must explicitly state `solver: "lisflood-fp"` and `engine: "LISFLOOD-FP 8.1"`.
- Under no circumstance is LISFLOOD-FP output ever labelled or reported as "Delft3D".

## 3. Physical Model Comparison

| Feature | Primary (Delft3D FM) | Fallback (LISFLOOD-FP) |
|---|---|---|
| **Governing Equations** | 2D Shallow Water Equations (SWE) | Inertial subgrid formulation (de Almeida & Bates 2012) |
| **Grid Topology** | Flexible unstructured quad/tri mesh | Regular Cartesian raster grid (30m cell) |
| **Advection Scheme** | Momentum-conserving Perot (1998) | Inertial-gravity wave approximation |
| **Compute Demand** | Higher (MPI parallelized) | Lower (OpenMP / single-core CPU capable) |
| **Use Case** | Primary detailed canyon hydrodynamics | Resilient fallback, fast screening runs |

## 4. Trigger & Activation Logic

The fallback is activated under two explicit conditions:
1. **Explicit User Selection**: The operator chooses `LISFLOOD-FP` from the solver dropdown in the Scenario Builder or Run Monitor.
2. **Automated Resilience Fallback**: If the Delft3D FM process terminates with a binary initialization error (e.g. missing MPI daemon), the worker catches the failure, logs an explicit fallback notification with `fallback_triggered: true`, and proceeds with LISFLOOD-FP.
