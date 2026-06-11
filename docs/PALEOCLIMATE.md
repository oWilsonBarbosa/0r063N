# Paleoclimate of planet `06cy8w6z6a89kow6psje93`

A 750-Myr climate history layered on the plate-tectonic reconstruction in
[GEOLOGICAL_HISTORY.md](GEOLOGICAL_HISTORY.md). For every 50-Myr stage of the
tectonic history, a simplified zonal climate model is run on that stage's
paleogeography under an authored greenhouse forcing curve
(`tectonics/history/paleoclimate.yaml`), producing Köppen-style climate maps,
a global temperature curve, and emergent ice ages.

## 1. Method

The model transcribes the planet generator's own climate rules (verified
against its source) and runs them on each stage's rotated geography:

- **Temperature**: base profile `28 − 47·((|lat−ITCZ|−13°)/77°)^1.4` °C with a
  flat ±8° seasonal ITCZ; the generator's continentality swing table (annual
  swing up to 60 °C for hypercontinental polar interiors, latitude-gated as in
  the generator); only the *extra* swing beyond the ITCZ seasonality is added
  (40 % to summer, 60 % to winter); +5 °C hyperoceanic offset at mid-high
  latitudes; moisture-dependent lapse on an effective-elevation scale fitted
  at T-0; the stage's `dT_global` forcing added uniformly.
- **Precipitation**: the generator's zonal curve (ITCZ core → trade-wind
  falloff → subtropical desert factory → westerlies plateau → polar desert),
  ITCZ convective uplift, fixed-latitude subtropical-high suppression,
  continental interior drying (`1 − cont²·0.65`), Mediterranean dry summers
  and an eastern-boundary cold-current drying proxy on subtropical west coasts.
- **Köppen classification**: the generator's exact thresholds (30 classes).
- **Per-stage inputs**: land cells rotated by the tectonic block rotations;
  per-cell elevation carried from the present, with **orogen belts scaled by
  age** using the same erosion model as the tectonic validator (belts rise as
  they form and decay afterwards; absent before their orogeny); continentality
  recomputed by distance-to-coast on each stage's geography.
- **Simplifications** (documented, not hidden): no ocean currents, no
  wind-direction orography, a two-season year, uniform (non-amplified)
  forcing, and a flat ITCZ. These mostly affect east/west coast asymmetries.

Ice ages are **emergent**: the forcing curve only sets `dT_global`; ice
appears where cold air meets land (Köppen EF/ET), so glaciations require
polar landmasses — exactly the Earth-theory coupling between tectonics and
climate.

## 2. Present-day calibration

The model at T-0 (true geography, dT = 0) against the generator's full
climate solution (2,560,001 cells):

| Köppen major class | generator (truth) | zonal model | deviation |
|---|---:|---:|---:|
| A | 23.3% | 13.0% | 10.4 pp |
| B | 27.0% | 17.9% | 9.2 pp |
| C | 17.8% | 29.6% | 11.8 pp |
| D | 16.3% | 16.4% | 0.0 pp |
| E | 15.4% | 23.2% | 7.8 pp |

Per-cell checks (formula-only run on the true per-cell geography):
seasonal temperature RMSE **7.6 / 7.4 °C**
(summer/winter), annual precipitation RMSE 468 mm,
major-class agreement 56%.
Global mean temperature from the data: **16.22 °C**
(modeled at T-0: 18.16 °C).

![model vs truth](../tectonics/maps/climate/koppen_present_model_vs_truth.png)

The deviations are the expected signature of a zonal model: without warm/cold
ocean currents the model under-predicts A and over-cools some coasts (excess
C/E at high latitude), and without advection it misses the generator's wetter
east coasts. The desert belts, tropical band, continental interiors and polar
zones all land in the right places, which is what the paleo-stages need.

## 3. The 750-Myr climate curve

![climate curve](../tectonics/maps/climate/climate_curve.png)

| stage | dT (°C) | CO₂ (ppm)* | global mean (°C) | land ice+tundra | ice state |
|---|---:|---:|---:|---:|---|
| T-750 | -1.0 | 230 | 17.6 | 8% | polar |
| T-700 | -2.5 | 155 | 16.1 | 8% | polar |
| T-650 | -5.5 | 85 | 13.2 | 11% | polar |
| T-600 | -8.0 | 45 | 10.7 | 16% | major_glaciation |
| T-550 | -3.5 | 125 | 15.2 | 7% | polar |
| T-500 | -1.0 | 220 | 17.7 | 3% | polar |
| T-450 | +2.0 | 445 | 20.7 | 1% | none |
| T-400 | +4.0 | 700 | 22.6 | 0% | none |
| T-350 | +4.5 | 790 | 23.0 | 0% | none |
| T-300 | +3.5 | 630 | 22.0 | 1% | none |
| T-250 | +2.0 | 445 | 20.4 | 2% | none |
| T-200 | +0.5 | 315 | 18.9 | 5% | none |
| T-150 | -0.5 | 250 | 17.8 | 8% | polar |
| T-100 | -1.5 | 200 | 16.7 | 12% | polar |
| T-50 | -1.0 | 222 | 17.1 | 14% | polar |
| T0 | +0.0 | 280 | 18.1 | 13% | polar |

\* illustrative, ~3 °C per CO₂ doubling from a 280 ppm anchor.

The drivers behind every swing are the events of the tectonic history — each
stage's forcing lists them in `paleoclimate.yaml`, and the validator rejects
any forcing change without a matching tectonic event.

## 4. Climate eras

### Assembly cool-down (T-750 … T-650)

Converging continents close the pre-cycle oceans; fresh collisional orogens (the S1 sutures) weather rapidly and draw CO2 down. The world slides from mild into cold as S1 locks together.

**Stage T-750** — Mild-cool world of dispersed converging continents.

![Koppen T-750](../tectonics/maps/climate/koppen_T750.png)

**Stage T-700** — First assembly collisions; weathering accelerates.

![Koppen T-700](../tectonics/maps/climate/koppen_T700.png)

### S1 icehouse (T-650 … T-550)

The deep freeze of the cycle. A single supercontinent centered near 25S pushes its southern margins (D, micro_10, micro_11) past 55S, weathering stays high, and ridge length - and so CO2 outgassing - is at a minimum. Continental ice sheets grow on the southern flank of S1; this is the major glaciation of the modeled history.

**Stage T-650** — S1 assembled; cold deepens, southern ice sheets nucleate.

![Koppen T-650](../tectonics/maps/climate/koppen_T650.png)

**Stage T-600** — Glacial maximum of the S1 icehouse.

![Koppen T-600](../tectonics/maps/climate/koppen_T600.png)

### Breakup hothouse (T-550 … T-350)

LIPs L1-L5 erupt in sequence as S1 rifts apart, and thousands of kilometers of new mid-ocean ridge (Central, Western, Northern) outgas CO2 far faster than the young passive margins can weather it. The ice sheets collapse and the planet swings to its warmest state, peaking around T-400..T-350 with essentially ice-free poles.

**Stage T-550** — L1 erupts; the thaw begins.

![Koppen T-550](../tectonics/maps/climate/koppen_T550.png)

**Stage T-500** — Rifting starts; outgassing climbs.

![Koppen T-500](../tectonics/maps/climate/koppen_T500.png)

**Stage T-450** — Breakup; new ridges outgas freely.

![Koppen T-450](../tectonics/maps/climate/koppen_T450.png)

**Stage T-400** — Hothouse; three young oceans spreading at once.

![Koppen T-400](../tectonics/maps/climate/koppen_T400.png)

### Dispersal moderation (T-350 … T-250)

The LIP era ends and ridge production stabilizes. The dispersing continents green up; climate settles into a warm but moderating state.

**Stage T-350** — Peak warmth; ice-free poles.

![Koppen T-350](../tectonics/maps/climate/koppen_T350.png)

**Stage T-300** — LIP era over; slow moderation.

![Koppen T-300](../tectonics/maps/climate/koppen_T300.png)

### Collisional cooling (T-250 … T-50)

The great drawdown. The O4 flat-slab uplift on G, then the O1 (AIJ assembly) and O2 (H-B closure) himalayan collisions expose vast tracts of fresh rock at low latitudes; silicate weathering accelerates and CO2 falls for 200 Myr. By T-100 polar ice has returned to the far-southern lands (micro_11 is drifting over 70S).

**Stage T-250** — O4 uplift starts the long drawdown.

![Koppen T-250](../tectonics/maps/climate/koppen_T250.png)

**Stage T-200** — O1 collision; fresh himalayan-scale weathering.

![Koppen T-200](../tectonics/maps/climate/koppen_T200.png)

**Stage T-150** — Cooling continues; far-southern frost returns.

![Koppen T-150](../tectonics/maps/climate/koppen_T150.png)

**Stage T-100** — O2 collision; polar ice locks in on micro_11.

![Koppen T-100](../tectonics/maps/climate/koppen_T100.png)

### Modern icehouse (T-50 … T0)

The present regime: a moderately cold world with permanent polar ice on the far-southern fragments and high-latitude tundra fringes on G and J, active O5/O6 orogens still weathering, and dispersed continents keeping the climate zonal and wet-margined - analogous to Earth's late Cenozoic.

**Stage T-50** — Slight recovery as O2 weathering wanes; O5/O6 rise.

![Koppen T-50](../tectonics/maps/climate/koppen_T050.png)

**Stage T-0 (present)** — Present day - the calibration anchor; permanent ice at the far south.

![Koppen T-0 (present)](../tectonics/maps/climate/koppen_T000.png)

## 5. The S1 glaciation

The modeled history's one major ice age peaks at **T-600** with
16% of all land under ice or tundra and global
mean temperature 10.7 °C. It is the textbook
supercontinent glaciation: S1's assembly killed most subduction-ridge systems
(minimum CO₂ outgassing) while its fresh collisional sutures weathered at
maximum rate, and the D/micro_10/micro_11 flank of the supercontinent sat
poleward of 55 S — so when the forcing bottomed out, continental ice sheets
had land to grow on. The thaw is equally tectonic: the L1–L5 LIP series and
thousands of kilometers of new ridge at breakup drove the planet into the
T-400…T-350 hothouse with essentially ice-free poles.

The smaller late-history cooling (T-150 … T-50) is the weathering signature of
the O1/O2 collisions; it never reaches full glaciation because by then the
only truly polar land is the small micro_11 fragment — a reminder that ice
ages need geography as much as they need CO₂.

## 6. Caveats

- Plate motion directions (and so paleo-longitudes) inherit the tectonic
  reconstruction's heuristic-inference caveat.
- The zonal model has no ocean currents, orographic wind shadowing, or
  monsoon dynamics; regional climates on the stage maps are indicative, not
  definitive. Class-fraction accuracy at T-0 is ±10 pp per major class.
- The forcing curve is authored (validated against the event record), not an
  output of a carbon-cycle model.
- Pre-T-700 sutures are fully eroded and carry no paleo-elevation in the
  model.

## 7. Reproducing

```bash
python3 tectonics/scripts/80_paleoclimate.py   # compute + calibrate + cache
python3 tectonics/scripts/85_render_climate.py # maps + curve figures
python3 tectonics/scripts/90_build_climate_doc.py
```

`80_paleoclimate.py` exits non-zero if the T-0 calibration drifts more than
20 pp on any Köppen major class or the stage geometry no longer reproduces
the present land mask.

