# Model Validation & Comparison Methodology

## 1. Multi-Solver Cross-Validation (Eulerian vs Lagrangian)

To quantify model credibility without relying on a single numerical solver, STRATA implements cell-by-cell common-grid cross-validation:

### Mathematical Formulations

1. **Flood Extent Intersection-over-Union (IoU) / Critical Success Index (CSI)**:
   $$IoU = \frac{|A \cap B|}{|A \cup B|} = \frac{TP}{TP + FP + FN}$$
   Where $A$ is the Eulerian Delft3D wet extent ($h \ge 0.15\text{ m}$) and $B$ is the Lagrangian DualSPHysics wet extent.

2. **Root Mean Square Depth Error (RMSE)**:
   $$RMSE = \sqrt{\frac{1}{N}\sum_{i=1}^{N}(h_{Delft,i} - h_{SPH,i})^2}$$

3. **Nash-Sutcliffe Efficiency (NSE)**:
   $$NSE = 1 - \frac{\sum (h_{obs,t} - h_{sim,t})^2}{\sum (h_{obs,t} - \bar{h}_{obs})^2}$$
   Evaluated at downstream reference stations. A score $>0.75$ indicates very good agreement ($0.942$ achieved along the Tehri reach).

## 2. Satellite-Observed Validation (Chamoli 2021 Benchmark)

- **Sensor**: Sentinel-1 C-Band Synthetic Aperture Radar (SAR) Ground Range Detected (GRD) in interferometric wide (IW) swath mode, dual polarisation (VV + VH).
- **Processing**: Calibrated, speckle-filtered (Lee filter $5\times 5$), terrain-corrected using Copernicus 30m DEM, and binarised using Otsu automated thresholding on the cross-polarisation ratio $\gamma^0_{VH} / \gamma^0_{VV}$.
- **Result Metrics**:
  - True Positive: $18.4\text{ km}^2$
  - False Positive: $2.6\text{ km}^2$
  - False Negative: $2.1\text{ km}^2$
  - Precision: $0.876$
  - Recall: $0.898$
  - Critical Success Index (IoU): $0.797$
