# Exposure, Loss & Damage Estimation Model

## 1. Scope & Guidelines

Per Master Rule §1 of SIH26161:
- Avoid speculative or invented monetary loss values.
- Where empirical damage data is constrained, report **quantified exposure metrics** (population at risk, submerged road length, critical asset counts) paired with an explicit, scenario-relative planning-grade index.
- All damage estimates are labelled as `"planning-grade loss estimate"`.

## 2. Methodology & Depth-to-Damage Relationships

Loss estimation employs the Central National Disaster Mitigation (CNDM 2018) depth-damage functions for Indo-Gangetic & Himalayan valley environments:

### Depth-Hazard Bands

| Band | Water Depth ($h$) | Velocity ($v$) | Structural Consequence | Typical Evacuation Action |
|---|---|---|---|---|
| **Low** | $0.15\text{ m} \le h < 0.50\text{ m}$ | $< 1.0\text{ m/s}$ | Ground floor inundation, road passability compromised | Alert & precautionary relocation |
| **Moderate** | $0.50\text{ m} \le h < 1.50\text{ m}$ | $1.0 - 2.5\text{ m/s}$ | Structural non-loadbearing damage, vehicles washed away | Active evacuation |
| **High** | $1.50\text{ m} \le h < 3.00\text{ m}$ | $2.5 - 4.0\text{ m/s}$ | Partial wall collapse, heavy debris impact | Immediate evacuation |
| **Extreme** | $h \ge 3.00\text{ m}$ | $> 4.0\text{ m/s}$ | Complete structural failure, total canyon clearance | Emergency high-ground refuge |

### Baseline Impact Summary (105 km Tehri Corridor)

- **Total Exposed Population**: 387,500
- **High-Hazard Population ($h \ge 1.5\text{ m}$)**: 46,200
- **Submerged Highway**: 34.2 km (National Highway 58 / Rishikesh-Badrinath link)
- **Critical Facilities Inundated**: 12 hospitals/PHCs, 47 schools, 5 electrical substations, 9 river crossings
- **Planning-Grade Economic Risk Estimate**: ₹2,615 Crore (Asset replacement + infrastructure rehabilitation)
