# Present-day tectonic inventory

Mesh verified uniform-on-sphere; areas from cos-lat-weighted pixel counts.

## Super-plates

| id | name | kind | area Mkm2 | land % | motion az | speed class | conf |
|---:|---|---|---:|---:|---:|---|---:|
| 0 | i | oceanic | 63.83 | 1 | 262.0 | 10-20 cm/yr (subducting oceanic) | 0.49 |
| 8 | ii | oceanic | 51.35 | 2 | 330.0 | 10-20 cm/yr (subducting oceanic) | 0.45 |
| 10 | iii | oceanic | 42.64 | 0 | 185.0 | <1 cm/yr (passive) | 0.19 |
| 7 | iv | oceanic | 32.45 | 1 | 105.0 | 10-20 cm/yr (subducting oceanic) | 0.84 |
| 16 | P16(CEF) | continental | 27.94 | 94 | None | 2-5 cm/yr (active-margin) | 0.0 |
| 17 | P17(AIJ) | continental | 27.19 | 98 | 193.0 | 2-5 cm/yr (active-margin) | 0.83 |
| 19 | P19(BDH) | continental | 26.14 | 98 | 300.0 | 2-5 cm/yr (active-margin) | 1.0 |
| 4 | v | oceanic | 26.11 | 1 | 53.0 | 10-20 cm/yr (subducting oceanic) | 0.49 |
| 9 | vi | oceanic | 25.76 | 3 | 60.0 | 10-20 cm/yr (subducting oceanic) | 0.65 |
| 3 | vii | oceanic | 24.44 | 3 | 102.0 | 10-20 cm/yr (subducting oceanic) | 0.58 |
| 5 | viii | oceanic | 23.06 | 4 | 120.0 | 10-20 cm/yr (subducting oceanic) | 0.32 |
| 18 | P18(G) | continental | 20.78 | 93 | None | 2-5 cm/yr (active-margin) | 0.0 |
| 13 | ix | oceanic | 20.6 | 5 | 157.0 | 10-20 cm/yr (subducting oceanic) | 0.68 |
| 2 | x | oceanic | 19.2 | 6 | 276.0 | 10-20 cm/yr (subducting oceanic) | 0.79 |
| 11 | xi | oceanic | 17.65 | 3 | 343.0 | <1 cm/yr (passive) | 0.65 |
| 14 | xii | oceanic | 17.51 | 4 | 228.0 | 10-20 cm/yr (subducting oceanic) | 0.68 |
| 6 | xiii | oceanic | 16.24 | 2 | 81.0 | 10-20 cm/yr (subducting oceanic) | 0.63 |
| 12 | xiv | oceanic | 12.85 | 3 | 6.0 | 10-20 cm/yr (subducting oceanic) | 0.74 |
| 15 | xv | oceanic | 8.21 | 2 | 266.0 | 10-20 cm/yr (subducting oceanic) | 0.83 |
| 1 | xvi | oceanic | 6.1 | 9 | 234.0 | 10-20 cm/yr (subducting oceanic) | 0.81 |

## Cratons

| craton | area Mkm2 | centroid | super-plate |
|---|---:|---|---:|
| A | 2.57 | [26.3, -105.0] | 17 |
| B | 1.42 | [-29.1, 46.3] | 19 |
| C | 1.14 | [-47.7, -142.9] | 16 |
| D | 0.63 | [-47.0, 60.6] | 19 |
| E | 0.55 | [-25.8, -138.8] | 16 |
| F | 0.31 | [0.3, -140.3] | 16 |
| G | 0.29 | [38.9, 102.2] | 18 |
| H | 0.28 | [-33.3, 28.8] | 19 |
| I | 0.25 | [34.0, -138.5] | 17 |
| J | 0.22 | [57.5, -113.2] | 17 |

## Continents

| name | cratons | area Mkm2 | centroid | super-plates |
|---|---|---:|---|---|
| G | G | 20.17 | [59.3, 93.1] | [0, 4, 5, 9, 11, 15, 18] |
| AIJ | A,I,J | 28.34 | [30.4, -105.3] | [1, 2, 5, 6, 10, 12, 14, 17] |
| CEF | C,E,F | 27.33 | [-21.8, -145.6] | [2, 5, 7, 8, 16] |
| BDH | B,D,H | 27.5 | [-35.2, 42.7] | [0, 3, 8, 10, 13, 19] |

## Microcontinents

- 1: 0.19 Mkm2 at [40.1, 51.9] (super-plate 9)
- 2: 0.09 Mkm2 at [40.1, -93.0] (super-plate 14)
- 3: 0.07 Mkm2 at [39.9, 168.3] (super-plate 11)
- 4: 0.14 Mkm2 at [33.2, 114.0] (super-plate 18)
- 5: 0.05 Mkm2 at [29.4, 150.6] (super-plate 11)
- 6: 0.17 Mkm2 at [26.9, 86.7] (super-plate 9)
- 7: 0.39 Mkm2 at [1.5, -114.3] (super-plate 2)
- 8: 0.12 Mkm2 at [-16.6, -156.1] (super-plate 16)
- 9: 0.09 Mkm2 at [-32.2, -104.1] (super-plate 2)
- 10: 0.12 Mkm2 at [-41.9, -24.7] (super-plate 6)
- 11: 0.08 Mkm2 at [-78.6, 25.6] (super-plate 3)

## Orogens (orogPow >= p85, 7 belts)

- O1: 3.22 Mkm2 at [54.3, -118.6], mean 1.58 km, max 7.54 km, blocks ['A', 'I', 'J']
- O2: 3.046 Mkm2 at [-42.9, 35.7], mean 1.89 km, max 5.18 km, blocks ['B', 'D', 'H']
- O3: 3.035 Mkm2 at [-43.9, -160.7], mean 1.53 km, max 6.65 km, blocks ['C']
- O4: 2.529 Mkm2 at [57.9, 79.3], mean 1.15 km, max 5.09 km, blocks ['G']
- O5: 2.148 Mkm2 at [33.9, -135.3], mean 2.65 km, max 8.43 km, blocks ['I']
- O6: 0.569 Mkm2 at [55.9, 135.4], mean 2.34 km, max 7.15 km, blocks ['G']
- O7: 0.238 Mkm2 at [3.0, -114.1], mean 0.4 km, max 1.68 km, blocks ['micro_7']

## Trenches

- T1: 0.481 Mkm2 at [11.5, 72.5], min -4.26 km
- T2: 0.346 Mkm2 at [2.5, -119.1], min -3.28 km
- T3: 0.309 Mkm2 at [29.0, 146.2], min -4.21 km
- T4: 0.303 Mkm2 at [14.1, 160.0], min -4.06 km
- T5: 0.214 Mkm2 at [-55.9, -39.6], min -4.36 km
- T6: 0.179 Mkm2 at [32.0, 86.7], min -3.27 km
- T7: 0.167 Mkm2 at [44.8, 132.5], min -3.0 km
- T8: 0.127 Mkm2 at [-25.7, 3.8], min -3.33 km
- T9: 0.112 Mkm2 at [26.4, 168.5], min -4.44 km
- T10: 0.107 Mkm2 at [-27.4, -25.9], min -4.64 km

## Back-arc basins

- B1: 3.289 Mkm2 at [25.6, -105.3]
- B2: 2.223 Mkm2 at [-47.5, -144.5]
- B3: 2.046 Mkm2 at [48.3, -117.5]
- B4: 1.691 Mkm2 at [-30.0, 50.3]
- B5: 1.319 Mkm2 at [-15.4, 29.1]
- B6: 1.195 Mkm2 at [4.4, -118.7]
- B7: 1.153 Mkm2 at [37.0, 37.1]
- B8: 1.118 Mkm2 at [11.8, 72.1]
- B9: 1.097 Mkm2 at [35.7, -130.8]
- B10: 1.058 Mkm2 at [-35.9, 29.6]

## Hotspots (top 15)

- H1: at [52.2, 10.5]
- H2: at [-32.4, -105.3]
- H3: at [-36.8, -103.9]
- H4: at [3.5, 121.7]
- H5: at [-60.0, 40.6]
- H6: at [-59.1, 37.3]
- H7: at [-57.8, 35.0]
- H8: at [5.8, -9.0]
- H9: at [5.7, -5.2]
- H10: at [-54.4, 29.6]
- H11: at [53.4, 7.1]
- H12: at [-27.9, -103.7]
- H13: at [20.5, -87.6]
- H14: at [-27.5, -103.3]
- H15: at [35.9, -93.9]

## Boundary segments

| pair | dominant | conv/div/trans frac | overriding |
|---|---|---|---|
| 14-15 | divergent | 0.06/0.94/0.00 | - |
| 3-8 | divergent | 0.23/0.77/0.00 | - |
| 15-18 | convergent | 0.97/0.02/0.00 | 18 |
| 3-19 | convergent | 0.93/0.00/0.00 | 19 |
| 0-8 | divergent | 0.04/0.96/0.00 | - |
| 14-17 | convergent | 0.95/0.01/0.00 | 17 |
| 8-16 | convergent | 0.93/0.00/0.00 | 16 |
| 12-17 | convergent | 0.86/0.00/0.00 | 17 |
| 7-16 | convergent | 0.74/0.00/0.00 | 16 |
| 13-19 | convergent | 0.97/0.00/0.00 | 19 |
| 4-10 | divergent | 0.00/1.00/0.00 | - |
| 5-16 | convergent | 0.38/0.00/0.00 | 16 |
| 5-17 | convergent | 0.88/0.01/0.00 | 17 |
| 6-8 | divergent | 0.15/0.85/0.00 | - |
| 5-18 | convergent | 1.00/0.00/0.00 | 18 |
| 2-16 | convergent | 0.45/0.00/0.00 | 16 |
| 3-10 | divergent | 0.07/0.93/0.00 | - |
| 0-7 | divergent | 0.00/1.00/0.00 | - |
| 9-18 | convergent | 0.66/0.00/0.00 | 18 |
| 4-18 | convergent | 0.99/0.01/0.00 | 18 |
| 9-13 | divergent | 0.00/1.00/0.00 | - |
| 0-19 | convergent | 0.74/0.01/0.00 | 19 |
| 0-11 | divergent | 0.00/1.00/0.00 | - |
| 3-6 | convergent | 0.62/0.38/0.00 | 3 |
| 11-18 | convergent | 0.12/0.00/0.00 | - |
| 4-15 | divergent | 0.02/0.98/0.00 | - |
| 7-11 | divergent | 0.50/0.50/0.00 | 11 |
| 2-8 | divergent | 0.02/0.98/0.00 | - |
| 2-12 | divergent | 0.41/0.59/0.00 | 12 |
| 5-15 | divergent | 0.10/0.90/0.00 | - |
| 0-9 | convergent | 0.86/0.14/0.00 | 0 |
| 4-13 | divergent | 0.00/1.00/0.00 | - |
| 10-13 | divergent | 0.00/1.00/0.00 | - |
| 8-19 | convergent | 0.83/0.00/0.00 | 19 |
| 5-11 | transform | 0.38/0.20/0.42 | 5 |
| 10-14 | divergent | 0.00/0.57/0.42 | - |
| 1-10 | divergent | 0.16/0.70/0.12 | - |
| 1-17 | convergent | 1.00/0.00/0.00 | 17 |
| 6-12 | divergent | 0.02/0.98/0.00 | - |
| 10-12 | divergent | 0.01/0.99/0.00 | - |
| 1-14 | divergent | 0.09/0.62/0.27 | - |
| 4-14 | divergent | 0.03/0.97/0.00 | - |
| 6-10 | convergent | 0.68/0.32/0.00 | 10 |
| 5-7 | divergent | 0.25/0.75/0.00 | 5 |
| 7-8 | divergent | 0.00/1.00/0.00 | - |
| 2-17 | convergent | 0.32/0.00/0.00 | 2 |
| 2-6 | divergent | 0.00/1.00/0.00 | - |
| 4-9 | divergent | 0.28/0.72/0.00 | 4 |
| 0-13 | divergent | 0.48/0.52/0.00 | 0 |
| 0-18 | convergent | 0.95/0.00/0.00 | 18 |
| 2-5 | divergent | 0.01/0.98/0.00 | - |
| 5-14 | divergent | 0.00/1.00/0.00 | - |
| 10-19 | convergent | 0.93/0.02/0.00 | 10 |
| 10-17 | convergent | 1.00/0.00/0.00 | 10 |
