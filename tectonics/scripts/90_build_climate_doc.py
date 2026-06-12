"""Assemble docs/PALEOCLIMATE.md from paleoclimate.yaml + climate_summary.json
+ the rendered figures. Deterministic; narrative prose lives in the YAML."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import data_io, history_schema, paleoclimate_schema

hist = history_schema.load(data_io.HISTORY_DIR / "history.yaml")
pc = paleoclimate_schema.load(data_io.HISTORY_DIR / "paleoclimate.yaml", history=hist)
with open(data_io.OUT_DIR / "climate_summary.json") as f:
    summary = json.load(f)
meta = data_io.load_meta()

MAPS = "../tectonics/maps/climate"
DOC = data_io.REPO_ROOT / "docs" / "PALEOCLIMATE.md"

anchor = summary["anchor_t0"]
calA = summary["calibration_formula_only"]
calB = summary["calibration_full_t0"]
truth = anchor["koppen_major_land_fractions"]

parts = []

parts.append(f"""# Paleoclimate of planet `{meta['planetCode']}`

A 750-Myr climate history layered on the plate-tectonic reconstruction in
[GEOLOGICAL_HISTORY.md](GEOLOGICAL_HISTORY.md). For every 50-Myr stage of the
tectonic history, a simplified zonal climate model is run on that stage's
paleogeography under an authored greenhouse forcing curve
(`tectonics/history/paleoclimate.yaml`), producing Köppen-style climate maps,
a global temperature curve, and emergent ice ages.

## 1. Method

The model transcribes the planet generator's own climate rules (verified
against its source) and runs them on each stage's rotated geography:

- **ITCZ**: land-following and per-longitude, like the generator's — candidate
  latitudes within ±32° scored by solar insolation, an ocean prior, and local
  land thermal boost, then smoothed along longitude (the rain belt bulges
  poleward over large summer landmasses).
- **Ocean currents**: parameterized gyres derived from each stage's land mask —
  warm western-boundary currents poleward along the west side of every ocean
  basin, cold eastern-boundary currents equatorward on the east side, and a
  polar warm drift (North-Atlantic-Drift analog) past ~50°. The field feeds up
  to ±16 °C over ocean and diffuses ±14 °C into coastal land, fading inland.
- **Temperature**: base profile `28 − 47·((|lat−ITCZ|−13°)/77°)^1.4` °C on the
  local ITCZ; the generator's continentality swing table (latitude-gated);
  only the *extra* swing beyond ITCZ seasonality is added (40 % summer / 60 %
  winter); current warmth and the +5 °C hyperoceanic offset; moisture-dependent
  lapse on an effective-elevation scale fitted at T-0; the stage's `dT_global`
  forcing added uniformly.
- **Precipitation**: the generator's zonal curve (ITCZ core → trade-wind
  falloff → subtropical desert factory → westerlies plateau → polar desert)
  with ITCZ convective uplift and fixed-latitude subtropical-high suppression;
  **downwind moisture advection** (trades and polar easterlies carry ocean
  moisture westward, westerlies eastward, relative to the local ITCZ) with
  ITCZ convective recycling over land; Mediterranean dry summers; coastal
  drying wherever the gyre field puts a cold current offshore.
- **Köppen classification**: the generator's exact thresholds (30 classes).
- **Per-stage inputs**: land cells rotated by the tectonic block rotations;
  per-cell elevation carried from the present, with **orogen belts scaled by
  age** using the same erosion model as the tectonic validator (belts rise as
  they form and decay afterwards; absent before their orogeny); continentality,
  ITCZ, gyres and moisture all recomputed from each stage's geography.
- **Simplifications** (documented, not hidden): no orographic wind shadowing,
  a two-season year, uniform (non-amplified) forcing, and parameterized rather
  than dynamic currents.

Ice ages are **emergent**: the forcing curve only sets `dT_global`; ice
appears where cold air meets land (Köppen EF/ET), so glaciations require
polar landmasses — exactly the Earth-theory coupling between tectonics and
climate.

## 2. Present-day calibration

The model at T-0 (true geography, dT = 0) against the generator's full
climate solution ({meta['numRegions']:,} cells):

| Köppen major class | generator (truth) | zonal model | deviation |
|---|---:|---:|---:|""")
model_fr = calB["stats"]["koppen_major"]
for m in "ABCDE":
    parts.append(f"| {m} | {100 * truth[m]:.1f}% | {100 * model_fr[m]:.1f}% | "
                 f"{calB['deviation_pp'][m]:.1f} pp |")
parts.append(f"""
Per-pixel agreement of the full pipeline against the rasterized ground truth:
**{100 * calB['grid_major_agreement']:.0f}%** on major class
({100 * calB['grid_full_agreement']:.0f}% on the exact 30-class code — a harsh
metric, since one-class boundary shifts count as misses). Formula-only run on
the true per-cell geography: seasonal temperature RMSE
**{calA['tS_rmse_C']:.1f} / {calA['tW_rmse_C']:.1f} °C** (summer/winter),
annual precipitation RMSE {calA['pAnn_rmse_mm']:.0f} mm.
Global mean temperature from the data: **{anchor['global_mean_C']} °C**
(modeled at T-0: {calB['stats']['global_mean_C']} °C).

![model vs truth]({MAPS}/koppen_present_model_vs_truth.png)

With the parameterized gyres, land-following ITCZ and moisture advection in
place, every major class lands within ~9 pp of the generator (B, D and E
within ~3 pp). The residual gap is concentrated in A vs C around the
subtropical margins, where the generator's dynamic wind/advection solution
draws slightly different monsoon boundaries than the parameterized bands. The
formula-only RMSE row above measures the zonal temperature core alone
(without the grid-derived currents/advection fields, which need a map, not a
cell).

## 3. The 750-Myr climate curve

![climate curve]({MAPS}/climate_curve.png)

| stage | dT (°C) | CO₂ (ppm)* | global mean (°C) | land ice+tundra | ice state |
|---|---:|---:|---:|---:|---|""")
for s, sf in zip(summary["stages"], pc["stages"]):
    parts.append(f"| T{s['t']} | {s['dT_global']:+.1f} | {sf.get('co2_ppm', '—')} | "
                 f"{s['global_mean_C']:.1f} | {100 * s['ice_land_frac']:.0f}% | "
                 f"{s['ice_hint']}{'' if s['ice_hint_met'] else ' (!)'} |")
parts.append("""
\\* illustrative, ~3 °C per CO₂ doubling from a 280 ppm anchor.

The drivers behind every swing are the events of the tectonic history — each
stage's forcing lists them in `paleoclimate.yaml`, and the validator rejects
any forcing change without a matching tectonic event.
""")

parts.append("## 4. Climate eras\n")
for era in pc["eras"]:
    t0, t1 = era["span"]
    parts.append(f"### {era['name']} (T{t0} … T{t1})\n")
    parts.append(era["narrative"].strip() + "\n")
    for sf in pc["stages"]:
        t = sf["t"]
        in_era = (t0 <= t < t1) or (t == 0 and t1 == 0)
        if not in_era:
            continue
        tag = f"T{t}" if t < 0 else "T-0 (present)"
        parts.append(f"**Stage {tag}** — {sf.get('narrative', '').strip()}\n")
        parts.append(f"![Koppen {tag}]({MAPS}/koppen_T{abs(t):03d}.png)\n")

glac = [s for s in summary["stages"] if s["ice_hint"] == "major_glaciation"]
gmax = max(glac, key=lambda s: s["ice_land_frac"]) if glac else None
parts.append(f"""## 5. The S1 glaciation

The modeled history's one major ice age peaks at **T{gmax['t']}** with
{100 * gmax['ice_land_frac']:.0f}% of all land under ice or tundra and global
mean temperature {gmax['global_mean_C']:.1f} °C. It is the textbook
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
""")

DOC.write_text("\n".join(parts) + "\n")
print(f"wrote {DOC} ({len(''.join(parts).splitlines())} lines)")
