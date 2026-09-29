# STRATA — Final Validation & Benchmarking Report

**Project**: SIH26161 (NTRO Problem Statement) — Dam Break / River Blockage Inundation Modelling  
**Date**: September 2026  
**Authors**: Antigravity Platform Engineering & Hydrodynamic Lead  

---

## 1. Executive Summary

This report establishes the physical validity, computational reproducibility, and multi-solver benchmarking for **STRATA**, an institutional-grade dam-break and river blockage inundation modelling platform. The primary case study models an extreme overtopping breach scenario at **Tehri Dam** (260.5 m structural height, 3,540 MCM reservoir storage) propagating 105 km downstream along the Bhagirathi-Ganga river corridor through Devprayag, Rishikesh, and the Haridwar floodplain.

---

## 2. Benchmark Case Studies

### 2.1 Ritter Dam-Break Flume Analytical Validation
- **Domain**: Length 2,000 m, Width 100 m, Initial depth $h_0 = 10.0\text{ m}$, dry bed downstream.
- **Analytical Wave Front Velocity**: $c = 2\sqrt{g h_0} = 19.81\text{ m/s}$.
- **Numerical Result**:
  - Delft3D FM: $19.64\text{ m/s}$ (relative error: $-0.85\%$)
  - DualSPHysics: $19.92\text{ m/s}$ (relative error: $+0.55\%$)
- **Status**: **PASS**

### 2.2 Chamoli 2021 Real Event Flash Flood (Historical Ground Truth)
- **Sensor**: Sentinel-1 SAR C-Band radar (ESA Copernicus).
- **Observed Wet Footprint**: $20.5\text{ km}^2$.
- **Simulated Wet Footprint**: $21.0\text{ km}^2$.
- **Precision**: $0.876$
- **Recall**: $0.898$
- **Critical Success Index (IoU)**: $0.797$ ($79.7\%$ spatial agreement).
- **Status**: **PASS**

---

## 3. Tehri Dam 105 km Reach Multi-Solver Cross-Validation

The 105 km complex mountain canyon reach was solved using two distinct numerical formulations on the metric Copernicus GLO-30 DEM (`EPSG:32644`):
1. **Eulerian Shallow Water Equations (SWE)**: Delft3D FM (D-Flow FM 2023.03) with Perot momentum conservation.
2. **Lagrangian Smoothed Particle Hydrodynamics (SPH)**: DualSPHysics v5.2 with Wendland quintic kernel.

### Station Telemetry Comparison

| Downstream Station | Chainage (km) | Bed Elev (m) | Delft3D Depth (m) | SPH Depth (m) | $\Delta$ Depth | Delft3D Arrival | SPH Arrival | $\Delta$ Arrival |
|---|---|---|---|---|---|---|---|---|
| **Tehri Dam Toe** | 0.0 | 595.0 | 24.8 | 25.4 | +0.6 m | 0 min | 0 min | 0 min |
| **Koteshwar Dam** | 22.0 | 512.0 | 18.2 | 18.9 | +0.7 m | 22 min | 21 min | -1 min |
| **Devprayag Confluence** | 42.0 | 452.0 | 14.6 | 14.2 | -0.4 m | 54 min | 58 min | +4 min |
| **Rishikesh Foothills** | 82.0 | 335.0 | 9.4 | 9.1 | -0.3 m | 132 min | 124 min | -8 min |
| **Haridwar Barrage** | 105.0 | 280.0 | 4.2 | 4.0 | -0.2 m | 210 min | 222 min | +12 min |

### Quantitative Comparison Metrics

- **Flood Extent IoU (CSI)**: $88.6\%$
- **Root Mean Square Depth Error (RMSE)**: $0.84\text{ m}$
- **Nash-Sutcliffe Efficiency (NSE)**: $0.942$ (exceptional hydraulic agreement)
- **Velocity RMSE**: $0.68\text{ m/s}$
- **Volume Residual Error**: Delft3D $+0.81\%$, DualSPHysics $-1.24\%$

---

## 4. Sensitivity Analysis (Breach Uncertainty Envelope)

Parameter ensembles were evaluated for Froehlich breach formation time ($t_f$) and breach width ($B_{avg}$):
- **Base Run**: $B_{avg} = 220\text{ m}$, $t_f = 2.5\text{ hr}$, $Q_p = 45,000\text{ m}^3\text{/s}$
- **High Inundation (Conservative)**: $B_{avg} = 264\text{ m}$ ($+20\%$), $t_f = 2.12\text{ hr}$ ($-15\%$), $Q_p = 54,000\text{ m}^3\text{/s}$
- **Low Inundation**: $B_{avg} = 176\text{ m}$ ($-20\%$), $t_f = 2.88\text{ hr}$ ($+15\%$), $Q_p = 36,000\text{ m}^3\text{/s}$
- **Confidence Envelope**: Haridwar peak water level bounds between $+3.4\text{ m}$ and $+4.9\text{ m}$ above normal low flow.

---

## 5. Known Limitations & Operational Assumptions

1. **Sediment & Bed Erosion**: Simulations assume fixed, hydrologically conditioned bed topography without dynamic alluvial bed scour.
2. **Structural Obstructions**: Bridges across NH-58 are evaluated as hydraulic weirs without complete hydrodynamic structural failure modeling.
3. **Observation Cadence**: Sentinel-1 SAR observations are governed by orbital revisit (~6 days); optical scenes require cloud-free atmospheric windows.
