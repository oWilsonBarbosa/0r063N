# Province Constraint Vectors — a query sheet for HRAF and D-PLACE

*Planet `06cy8w6z6a89kow6psje93` · the physical envelope each province imposes on
any culture that lives in it, expressed in the variables that cross-cultural
databases actually index on.*

This document does **not** invent cultures. It converts the locked physical
canon into **query keys** — the numbers you type into eHRAF Archaeology,
eHRAF World Cultures, and D-PLACE to retrieve the Earth societies that solved
the same problem, so that invention starts from the *envelope* of real
solutions rather than from one remembered example.

Labels follow the Phase-5 convention: **MEASURED** (from the dataset),
**INTERPRETED** (a reading of the physical record), **INVENTED** (creative
choice). Everything in the tables below is MEASURED or a stated derivation
from MEASURED values. Nothing here is INVENTED.

---

## 1. How to use this

1. Pick a province. Read its constraint vector (§3).
2. Run the **D-PLACE filter** on its environmental variables. You get a set of
   georeferenced Earth societies that live inside the same envelope, already
   joined to coded cultural traits (Ethnographic Atlas, SCCS, Binford).
3. Run the **eHRAF query** on the listed traditions. You get full text, indexed
   to paragraph level by OCM subject code.
4. Read for **two things, not one**:
   - the **invariants** — what every society in that envelope had to solve.
     These are *requirements*, and your people must answer them too.
   - the **variance** — the genuinely different answers they gave. This is your
     menu. Pick a non-modal option and you get plausible without derivative.
5. Check the choice against [`../life/01_BIOGEOGRAPHIC_REALMS.md`](../life/01_BIOGEOGRAPHIC_REALMS.md).
   A subsistence mode is only available if the realm's biota can supply it.

**Use it backwards too.** The subsistence *requirements* that fall out of step 4
are a design brief for the biology layer: if a province's envelope demands a
herdable, cellulose-converting, cold-tolerant animal, that is a specification
the biology has to fill. Three of those documents now exist —
[`../life/03_HUMANOID_ANCESTRY.md`](../life/03_HUMANOID_ANCESTRY.md),
[`04`](../life/04_MERIDIAN_ARID_INTERIOR.md) (M3) and
[`05`](../life/05_SELVANAN_INTERIOR_DRY_BASIN.md) (V3) — and they answer the
brief for M3 and V3 with **Flushgrass → cereal** and **Rainherd → pack-and-milk
animal**, plus their Selvanan congeners. The remaining provinces (`../life/06+`)
are still unwritten, so keep reading this document backwards for those.

---

## 2. Method and its limits

Read these before trusting a number.

| Quantity | How it is derived | Limit |
|---|---|---|
| Height | Canonical Earth-fitted power mapping of raw `elev` (`tools/height-mapping.mjs`), **not** the legacy `elev_km` column | Differs from the climate model's internal S-curve by ~0.35 km mean; see [`relief_coast_diagnostic`](../../reports/audit/relief_coast_diagnostic/README.md) |
| Temperature | `°C = -45 + t × 90` on `tS`/`tW` | **Two seasons, not twelve.** "Cold-season mean" is not the coldest *month*; true monthly extremes are colder |
| Precipitation | `(pS + pW) × 813.7` mm/yr — fitted to the generator snapshot that produced this export (§2.1) | Censored, and reliability varies sharply by climate class — §2.2 |
| Wet-season share | `max(pS,pW) / (pS+pW)` | Scale-invariant, so the calibration does not move it. The cap still compresses it. Use the Köppen class as the authority on seasonality — `Af` vs `Aw` vs `Am` is computed by the generator on **uncapped** values, so the class label is strictly better evidence than the `Wet` figure beside it |
| NPP | Miami model, `min(3000/(1+e^(1.315−0.119T)), 3000(1−e^(−0.000664P)))` g/m²/yr | More robust than the precipitation it is built from — §2.3 |
| Growing season | % of province area with warm-season mean ≥ 10 °C (Köppen tree-line criterion) | A proxy for *extent*, not *length in days* |
| Frost-free | % of area with cold-season mean > 0 °C | Two-season data hides monthly frost; treat as optimistic |

### 2.1 The precipitation calibration

The seasonal columns `pS`/`pW` are dimensionless — each is the raw field
divided by its own 95th percentile. Turning them into millimetres needs a
scale, and the scale has to be fitted to **the generator that produced this
export**, which `orogen_meta_full_v2.json` pins as snapshot `f9bb081`
(2026-04-15). That qualifier is load-bearing: the generator has changed
substantially since — `js/elevation.js` was largely rewritten and
`js/climate-config.js` did not yet exist — so its present-day climate
constants do not transfer backwards.

Three candidates, all measured by running `f9bb081`'s own climate chain on
`assets/earth.png` at N = 160,001
([`earth-calibration-snapshot.mjs`](../../tools/province-vectors/earth-calibration-snapshot.mjs)):

| Scale | Origin | Earth land mean | Error vs observed ~715 mm/yr |
|---|---|---:|---:|
| 1000 | hardcoded in `f9bb081`'s `koppen.js` | 879 mm/yr | **+23 %** |
| 838.5683 | the *current* generator's fitted `KOPPEN_PRECIP_SCALE_MM` | 737 mm/yr | +3.1 % |
| **813.7** | **fitted to `f9bb081` here** | **715 mm/yr** | **0 %** |

The 1000 was a placeholder, not a calibration — which is exactly why the later
climate-tuning commit replaced it with a fitted parameter. The 838.5683 is a
real calibration, but of a *different* precipitation model.

Corroborating the choice of reference: `f9bb081` censors **13.48 %** of Earth
land cells at the p95 cap, closely matching this planet's own **13.80 %**. The
current generator gives 19.84 %.

**One caveat, and it is unavoidable.** The exported `koppen` column was
classified by the generator using its uncalibrated 1000, so millimetres on the
813.7 scale will not exactly reproduce the Köppen boundaries stored beside
them. The labels are immutable canon computed with a placeholder. Physical
accuracy wins here because everything these millimetres feed — terrain
classes, humidity bands, D-PLACE `Bio12` filters — is stated in real
millimetres and compared against real-world data. Where a decision turns on
the boundary itself rather than on the amount, trust the stored `koppen`
label.

### 2.2 Where the millimetres are trustworthy, and where they are not

A single scale factor fixes the global mean, not the distribution. `f9bb081`'s
simulated per-class land means, converted at 813.7, against typical Earth
values for the same class:

| Class | sim mm | Earth ~mm | ratio | | Class | sim mm | Earth ~mm | ratio |
|---|---:|---:|---:|---|---|---:|---:|---:|
| `Af` | 1448 | 2200 | 0.66 | | `Cfb` | 925 | 900 | 1.03 |
| `Am` | 1186 | 1800 | 0.66 | | `Csa` | 488 | 500 | 0.98 |
| `Aw` | 833 | 1100 | 0.76 | | `Dfa` | 772 | 700 | 1.10 |
| `BWh` | 173 | 100 | 1.73 | | `Dfb` | 990 | 650 | 1.52 |
| `BSh` | 381 | 400 | 0.95 | | `Dfc` | 1119 | 450 | 2.49 |
| `BSk` | 248 | 350 | 0.71 | | `ET` | 1057 | 250 | 4.23 |
| `Cfa` | 733 | 1200 | 0.61 | | `EF` | 394 | 100 | 3.94 |

| Reliable (0.85–1.25×) | Understated (0.6–0.8×) | Overstated (1.5–4×) |
|---|---|---|
| `BSh` `Cfb` `Csa` `Dfa` | `Af` `Am` `Aw` `BSk` `Cfa` | `BWh` `Dfb` `Dfc` `ET` `EF` |

Two different causes. The tropical and warm-temperate deficit is largely
**censoring** — 13.5 % of land cells clipped at the cap, concentrated on the
ITCZ peak and on wet subtropical east coasts. The cold-class excess is a
genuine **model bias**: simulated `ET` averages 1,057 mm against a real-world
~250 mm.

What that means province by province:

| Province | Precipitation figure | Read it as |
|---|---|---|
| M3 · S2 · V3 | **Reliable**, slight overstatement from their `BWh` fraction | Use as stated |
| V4 · M2 | **Mixed** — `Dfa`/`Csa` reliable, `Dfb`/`Dfc` high | Treat as an upper bound |
| M4 · S1 · V1a · V1b · B1 | **Understated ~25–35 %** | A floor |
| S3 · B2 | **Overstated ~2–2.5×** | B2's 831 mm is likely nearer 400 |
| M1 · B3 | **Overstated ~4×** | Ice-dominated; treat as "very dry" |
| V2 | **Unknown** | Tropical alpine has no Earth counterpart at this scale, and the `ET` bias was measured on polar tundra. Do not transfer it |

The arid provinces — the ones where precipitation actually decides the
culture — remain the best-calibrated, because `B` is where the Köppen
thresholds bite hardest and so is what the generator was most constrained to
get right.

### 2.3 Why NPP survives this better than precipitation does

The Miami model takes the *minimum* of a temperature-limited and a
precipitation-limited term, so a province's NPP is only as wrong as its
precipitation if precipitation is the binding constraint. Share of each
province that is temperature-limited:

| ≥ 40 % temperature-limited (NPP robust) | Precipitation-limited (NPP tracks the precipitation) |
|---|---|
| B3 98 % · B2 84 % · S3 56 % · M1 53 % · V4 46 % · V2 41 % | M3 · S2 · V3 · M4 · V1a 0 % · V1b 3 % · S1 7 % · B1 12 % |

The provinces whose precipitation is least reliable are almost exactly the
ones whose NPP does not depend on it. Recalibrating from 1000 to 813.7
moves B2's NPP by only 3.2 % (793 → 768) because it is temperature-limited,
while M3's moves 16 % (645 → 539) because it is not. (Both pairs were computed
on the pre-correction partition of §2; the effect they illustrate is a property
of the precipitation scale, not of continent membership, and the corrected
partition puts the same endpoints at 761 and 537.)

The exception worth remembering: **V1a and M4 are precipitation-limited *and*
censored**, so their NPP figures are floors as well.


**Which continent a cell belongs to.** Every land cell is assigned to its
**connected landmass**, keyed to the continent centroids in
`reports/tectonics/inventory.json` — the same definition the tectonics pipeline
and [`../BIOGEOGRAPHY.md`](../BIOGEOGRAPHY.md) use, ported for the Node tools as
[`../../tools/continents.mjs`](../../tools/continents.mjs). Detached land falls
in an **Islands** bucket rather than being folded into whichever continent lies
nearest.

> **This replaces a longitude proxy, and the table below has been regenerated.**
> Earlier versions separated Meridia from Selvana on the −128° meridian and
> discarded western-hemisphere land below 16 °S. That rule dropped **1.80 Mkm²
> of land** (1.69 % of the planet's land) and undercounted **Selvana by 5.1 %**
> against the authoritative areas, while inflating the other three continents.
> The correction moves **B1 −21 %**, **V4 +15.2 %**, **M4 −9.6 %**, **S3 −7.3 %**,
> **S1 −5 %**, **V1b +6.8 %**; every other province moves by ≤ 2.3 %, and no
> climate figure moves by more than a rounding unit. Reproduce the old table
> with `--continents proxy`; see `tools/province-vectors/validate-continents.mjs`
> for the full delta and `../life/05_SELVANAN_INTERIOR_DRY_BASIN.md` §7 for how
> it was found.

**Province boundaries are operational.** The fifteen provinces are those of
[`../life/01_BIOGEOGRAPHIC_REALMS.md`](../life/01_BIOGEOGRAPHIC_REALMS.md),
but that document names them without drawing them. The rules below are my
reproducible approximation, applied in priority order per continent:

```
Meridia   h≥2.0km → M1 · lat≥45 → M2 · Köppen B → M3 · else M4
Sirocca   lat≤-50 → S3 · Köppen B → S2 · else S1
Borea     h≥1.5km or EF → B3 · Köppen C or B → B1 · else B2
Selvana   h≥2.0km & |lat|<20 → V2 · lat≤-42 → V4 · B & lat≤-15 → V3
          · lat≤-15 → V1b · else V1a
```

Two consequences to keep in view:

- **V1b is not in the realms document.** Selvana's non-arid subtropical belt
  (16–41°S, `Cs`/`Aw`) has no province of its own there, and averaging it into
  the Tropical North destroys both. It is broken out here as an operational
  zone and flagged wherever it appears.
- **M4 is broad.** The rule catches all of Meridia's non-arid, non-montane land
  below 45°N, which merges the tropical south with the humid east coast. Its
  vector is an average over two genuinely different places; split it before
  designing anything specific.
- **Islands is an accounting row, not a province.** It exists so that every
  land cell lands somewhere and none goes missing the way the proxy's
  1.80 Mkm² did. Its vector averages a pole-to-pole scatter (−72° to 55°,
  61 % coastal) and describes nowhere: **never design against it.** For island
  habitats use the per-habitat island rows in [`../BIOGEOGRAPHY.md`](../BIOGEOGRAPHY.md).

---

## 3. The master table

Area in millions of km². Temperatures °C. Precipitation mm/yr. NPP g/m²/yr.
"Wet" = share of annual precipitation falling in the wetter season.

| Province | Area | Lat (5–95 %) | Elev mean / max | >2 km | T cold | T warm | T ann | Precip | Wet | NPP | Frost-free | Growing | Coastal |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **M1** W. Cordillera & Central Massif | 5.1 | 10–58 N | 2.99 / 7.66 | 100 % | −12.2 | −1.1 | −6.7 | 312 ‡ | 60 % | 331 | 21 % | 25 % | 0.0 % |
| **M2** Northern Cold Highlands | 5.1 | 46–62 N | 0.56 / 2.0 | 0 % | 0.2 | 21.0 | 10.6 | 799 ~ | 58 % | 1068 | 54 % | 95 % | 6.5 % |
| **M3** Arid Interior Plateau | 9.3 | 16–42 N | 0.77 / 2.0 | 0 % | 17.7 | 26.8 | 22.3 | 303 | 65 % | 537 | 98 % | 100 % | 2.6 % |
| **M4** S. Tropical Lowlands & SW Trunk | 8.6 | 7 S–43 N | 0.58 / 2.0 | 0 % | 21.4 | 25.7 | 23.5 | 958 + | 65 % | 1353 + | 96 % | 100 % | 9.1 % |
| **S1** Northern Range & SW Wet Coast | 10.9 | 5–49 S | 0.92 / 6.98 | 18 % | 14.9 | 21.8 | 18.4 | 830 + | 60 % | 1171 + | 87 % | 86 % | 6.8 % |
| **S2** The Arid Heart | 12.1 | 21–46 S | 0.80 / 2.8 | 5 % | 17.6 | 27.1 | 22.4 | 277 | 64 % | 498 | 98 % | 100 % | 1.0 % |
| **S3** Southern Cold Fringe | 4.3 | 50–71 S | 0.83 / 4.74 | 12 % | −1.7 | 14.2 | 6.3 | 883 ‡ | 54 % | 951 | 49 % | 74 % | 12.5 % |
| **B1** Southern Maritime Coast | 3.1 | 26–45 N | 0.22 / 1.49 | 0 % | 7.2 | 27.0 | 17.1 | 643 + | 72 % | 950 + | 100 % | 100 % | 13.1 % |
| **B2** Subarctic Interior | 12.6 | 47–72 N | 0.45 / 1.5 | 0 % | −10.8 | 14.8 | 2.0 | 831 ‡ | 59 % | 761 | 0 % | 66 % | 5.6 % |
| **B3** E. Range & N. Ice Highlands | 4.3 | 50–77 N | 1.97 / 6.12 | 42 % | −28.5 | −5.2 | −16.9 | 485 ‡ | 60 % | 163 | 0 % | 9 % | 1.7 % |
| **V1a** Tropical North | 9.9 | 13 S–20 N | 0.40 / 2.0 | 0 % | 23.4 | 25.8 | 24.6 | 1160 + | 63 % | 1578 + | 100 % | 100 % | 9.5 % |
| **V1b** Subtropical Belt *(operational)* | 5.1 | 17–41 S | 0.32 / 5.51 | 3 % | 12.2 | 26.4 | 19.3 | 688 + | 69 % | 1061 + | 96 % | 97 % | 6.0 % |
| **V2** Equatorial Ranges (sky-islands) | 0.8 | 17 S–14 N | 2.63 / 6.17 | 100 % | 3.0 | 10.0 | 6.5 | 755 ? | 70 % | 968 | 68 % | 58 % | 0.1 % |
| **V3** Interior Dry Basin | 4.8 | 18–40 S | 0.22 / 2.23 | 0 % | 14.9 | 29.2 | 22.1 | 352 | 68 % | 621 | 100 % | 100 % | 1.8 % |
| **V4** Southern Cordillera & Cold South | 6.5 | 43–60 S | 0.71 / 6.14 | 8 % | −5.2 | 19.6 | 7.2 | 791 ~ | 58 % | 952 | 21 % | 89 % | 5.6 % |
| *Islands* — accounting row, **not a design envelope** | 4.0 | 72 S–55 N | 0.09 / 2.67 | 0 % | 12.8 | 22.8 | 17.8 | 968 | 61 % | 1199 | 84 % | 92 % | 61.3 % |

Precipitation uses the calibrated scale (§2.1). Reliability marks from §2.2:
`+` understated, treat as a floor · `‡` overstated ~2–4× · `~` mixed, treat as
an upper bound · `?` no Earth counterpart, do not bias-correct.

---

## 4. Per-province query blocks

Each block gives the D-PLACE environmental filter, the eHRAF traditions worth
pulling, the **invariants** the envelope forces, and the **variance axis** —
the decision where Earth societies in this envelope genuinely diverged, and
therefore where your invention should live.

D-PLACE variable names: `Bio1` = mean annual temperature, `Bio12` = annual
precipitation, `NPP`, `ET` = Binford's effective temperature (in the
Hunter-Gatherer dataset).

---

### M1 · Western Cordillera & Central Massif
`Bio1 −10…0 · Bio12 75–250 · NPP <400 · Köppen EF/ET · elev >2000 m`
*Simulated 312 mm is overstated ~4× (§2.2); filter on the Earth-equivalent.*

High, cold, dry, and 100 % above 2 km — 93 % of the land over 3 km is `EF` ice.
Terrestrial NPP of 331 is at the edge of what supports year-round occupation.

- **eHRAF**: Tibetan (Changtang) pastoralists · Central Andean puna (Wankarani,
  Tiwanaku highland) · Pamiri · Ladakhi
- **Invariants**: vertical zonation of settlement; pass control as the only
  political geography that matters; a cellulose-converting cold-tolerant pack
  and milk animal is mandatory (yak, camelid, or your equivalent) — without it
  the province is transit only, not residence.
- **Variance axis**: whether the highland is a *homeland* (Tibet, Andes: dense,
  states, own agriculture) or a *corridor* (Pamir, Karakoram: thin, trade-fed,
  no indigenous state). Both are attested at this NPP. Choose deliberately —
  it decides whether Meridia has one civilisation or two separated by a wall.

### M2 · Northern Cold Highlands
`Bio1 8–13 · Bio12 600–850 · NPP ~1070 · Köppen Cfa/Cfb/Dfb`

**Mislabelled in the compendium.** Called "subarctic (D/E)", but the data reads
C 45 % / D 37 %, mean 10.4 °C, cold season at freezing, 95 % of it above the
tree-line threshold. This is oceanic temperate — Britain, Denmark, Oregon —
not taiga.

- **eHRAF**: Northwest Coast (Coast Salish, Kwakwaka'wakw) · Early Medieval
  North Sea · Atlantic European Neolithic
- **Invariants**: high productivity with a real winter — storage is possible
  and necessary, which is the classic precondition for hereditary rank without
  agriculture.
- **Variance axis**: farming vs. storage-based foraging. The Northwest Coast
  proves you can get stratification, slavery, and monumental art on salmon
  alone at this NPP. Meridia's north does not require agriculture to become
  complex.

### M3 · Arid Interior Plateau
`Bio1 20–25 · Bio12 250–350 · NPP ~540 · Köppen BSh/BWh · frost-free`

Hot semi-desert that never freezes, and holds the planet's deep salt sea
(128,383 km², 17.3 °N 101.8 °W) — a **Caspian**, not a playa.

- **eHRAF**: Saharan and Sahelian pastoral · Arabian bedouin · Hohokam and
  Sonoran · Rajasthan / Thar
- **Invariants**: water rights are the constitution; mobility is capital;
  storage is against drought, not winter.
- **Variance axis**: a deep permanent inland sea is *not* the Sahara case. It
  supports fisheries, shipping, and a shoreline city belt in the middle of a
  desert — closer to the Caspian littoral or the Aral before 1960. Decide
  whether the sea unifies the plateau or divides it.

### M4 · Southern Tropical Lowlands & SW Trunk River
`Bio1 22–25 · Bio12 1200–1450 · NPP ≥1350 · Köppen Aw/Am/Cfa`
*Broad province — split before use.*

Contains the SW trunk river: 1,980 km, **383 km³/yr**, mouth 5.7 °S 85.4 °W
onto a delta that is 49 % `Aw` / 29 % `BSh`, one wet season.

- **eHRAF**: Indus (Harappan) · Ganges Neolithic and Painted Grey Ware ·
  mainland Southeast Asian riverine · Orinoco/llanos
- **Invariants**: annual flood pulse sets the calendar; delta agriculture with
  a dry hinterland; natural port at the mouth.
- **Variance axis**: the Indus analogue holds better than it first appeared.
  Before the precipitation calibration (§2.1) this river read as 597 km³/yr —
  3–6× the Indus, so abundant that the "civilisation clinging to one thread"
  story looked unavailable. Recalibrated it carries **383 km³/yr**, about 1.6×
  the pre-dam Indus, which puts it squarely in the same class. The delta is
  still `Aw`/`BSh` with one flood pulse a year, and the hinterland is still
  dry. Treat it as a genuine Indus, with the caveat that a river this size is
  avulsion-prone: cities here get abandoned, not besieged.

### S1 · Northern Range & SW Wet Coast
`Bio1 16–21 · Bio12 1000–1300 · NPP ≥1170 · Köppen Af/Cfb + elev >2000 m band`

A 6.98 km near-equatorial wall against the continent's only reliable maritime
margin. Includes the 3,243 km / **865 km³/yr** river reaching the sea at
11.7 °S 40.8 °E into 78 % `Af` rainforest — a Congo, not a Nile.

- **eHRAF**: Central Andean (Chavín, Moche, Wari) · Ethiopian highland ·
  Highland and coastal New Guinea
- **Invariants**: extreme vertical compression of ecozones over short
  horizontal distance; complementary-zone exchange is nearly forced.
- **Variance axis**: whether verticality is managed by one polity holding all
  tiers (Andean "vertical archipelago") or by trade between tier-specialised
  peoples (New Guinea). This is the single richest design decision on Sirocca.

### S2 · The Arid Heart
`Bio1 20–25 · Bio12 230–320 · NPP ~500 · Köppen BSh/BWh · endorheic`

The most distinctive province on the planet. 12.1 M km², 1.1 % coastal, and
drained by **3,000–3,450 km rivers that all die in a terminal salt lake** at
~28 °S 43 °E. It also holds the Nile-profile river — 4,036 km, **34 km³/yr**,
one of the very few that escapes to the sea (21.1 °S 43.2 °E).

- **eHRAF**: Bactria-Margiana (Oxus civilisation) · Tarim Basin oasis states
  (Loulan, Niya) · Saharan pastoral · Central Asian oasis-urban
- **Invariants**: oasis-chain settlement; caravan economics; salt as an export;
  no downstream — and therefore **no upstream-downstream water politics**.
- **Variance axis**: this is the key point. Mesopotamia's state-formation engine
  was conflict over a shared exorheic river. An endorheic basin removes that
  engine entirely; Earth's answer (BMAC, Tarim) was many walled oasis
  city-states that never unified. The one river here that *does* reach the sea
  is therefore the anomaly — and the best candidate on the planet for an
  early hydraulic state, precisely because it is starved enough to require one.

### S3 · Southern Cold Fringe
`Bio1 4–8 · Bio12 400–700 · NPP ~950 · Köppen Cfb/Cfc/ET · ET (Binford) low`
*Simulated 909 mm is overstated ~2× (§2.2).*

Cool, wet, oceanic, 16.3 % coastal — the highest coastal fraction of any
province.

- **eHRAF**: Fuegian (Yámana, Selk'nam) · Chono and Chilean archipelago ·
  Norse North Atlantic · Aleut
- **Invariants**: marine subsistence dominates; boats are infrastructure, not
  transport; fuel and shelter are year-round problems at 47 % frost-free.
- **Variance axis**: maritime foragers (Fuegian: mobile, egalitarian, canoe-
  based) vs. maritime farmers (Norse: sedentary, stratified, livestock on a
  thin margin). NPP 926 permits either.

### B1 · Southern Maritime Coast
`Bio1 15–20 · Bio12 800–1050 · NPP ~950 · Köppen Csa/Cfa · frost-free 100 %`

Borea's warm refuge — 26–45 °N, never freezes, **winter-wet**, 13.1 % coastal
(the highest of any mainland province). On a continent that is 84.1 % D+E, this
is the anomaly that will hold most of its people: it is **15.6 % of Borea and
holds 98.7 % of its frost-free land**.

Not one climate but two, flipping at about 32 °N: a winter-wet Mediterranean
north (67.6 % of the province, `Csa`-dominant, 91–98 % of cells winter-wet) and
a summer-wet subtropical south (20.6 %, `Cfa`/`Cwa`). Design the planting
calendar for whichever half you are in — they are six months out of phase.

- **eHRAF**: **Mediterranean California (Chumash, Ohlone)** — the closest
  structural analogue, see the invariants · Aegean and Anatolian Neolithic ·
  Levantine (Natufian, PPNA) · Iberian · and, for the summer-wet southern
  fifth only, Jōmon and the Southeast Chinese Neolithic (Hemudu, Liangzhu)
- **Invariants**: the best cereal-domestication setting on the planet — a
  Mediterranean summer drought manufactures large-seeded storable winter
  annuals ([`../life/07`](../life/07_BOREAN_SOUTHERN_MARITIME_COAST.md) names
  the plant **Winterseed**) — **and no animal to pair with it**: Borea has no
  endotherms at all, so no pack, milk, traction or wool animal exists. No
  plough without an import, therefore hoe-capped field size; no pastoral
  neighbours anywhere on the continent; but ectotherm browsers are nearly free
  to keep penned, so expect **husbandry as a larder, not as a herd**. A
  population sink for the whole continent, behind the planet's hardest
  ecological border.
- **Variance axis**: whether it is Borea's core or Borea's frontier — is the
  cold interior a hinterland this coast exploits, or a rival that raids it?

### B2 · Subarctic Interior
`Bio1 0–4 · Bio12 300–450 · NPP ~760 · Köppen Dfc/Dfb · frost-free 0 %`
*Simulated 831 mm is overstated ~2.5× (§2.2); real taiga runs 400–600 mm, and
the corrected figure is what actually matches the Volga-Kama analogue.*

The taiga. Near-exact match to Volga-Kama (Kirov: 18 °C / −13 °C, mean 2.5 °C).

- **eHRAF**: Uralic and Finno-Ugric taiga · Western Siberian (Khanty, Mansi,
  Evenki) · Northern Athabaskan · Subarctic Algonquian
- **Invariants**: winter fodder is the binding constraint — no dairy pastoralism
  without hay-making; rivers are the only highways and the flood calendar
  governs everything; fur is the export that buys everything else.
- **Variance axis**: reindeer-analogue herding vs. riverine fishing-hunting.
  Both occupy this envelope on Earth and they produce completely different
  political scales. Requires a decision from the biology layer first.

### B3 · Eastern Range & Northern Ice Highlands
`Bio1 <−15 · Bio12 <200 · NPP <200 · Köppen EF · elev mean ~2000 m`

**A 2 km ice dome, not an Arctic coast** — mean elevation 1.96 km, 42 % above
2 km, mean −16.8 °C, NPP 163. The Earth analogue is the Greenland ice sheet
(mean ice elevation 2.1 km, interior ≈ −20 °C), not Yamal or Chukotka.

- **eHRAF**: Thule and Inuit (margins only) · Chukchi · Tibetan Changtang
- **Invariants**: NPP 163 means essentially no terrestrial production. Anyone
  here is marine-subsidised, transient, or dead. There is no indigenous
  agriculture and no year-round interior settlement.
- **Variance axis**: none worth designing in the interior. Design the *edge* —
  who crosses it, why, and what they believe is on top.

### V1a · Tropical North
`Bio1 23–26 · Bio12 >1450 · NPP >1570 · Köppen Af/Am/Aw · frost-free 100 %`

Highest NPP on the planet, and both figures are floors under the cap. The NE/N
deltas here are 47–49 % `Af` — **ever-wet, not monsoon**; the wet/dry ratio is
about 1.4 : 1 where real monsoon deltas run 5 : 1 to 20 : 1.

- **eHRAF**: Amazonian (Marajoara, Upper Xingu) · Congo Basin Bantu · Island
  Southeast Asian · Niger Delta
- **Invariants**: no dry season means no natural storage season and rapid
  decay — wealth is held in people, land improvement, and obligation rather
  than in granaries; soils leach; terra-preta-style soil building is the
  attested workaround.
- **Variance axis**: the anti-Mesopotamia. High productivity with *no storable
  surplus* has historically produced large populations without centralised
  states. If you want a delta empire here you need an explicit reason.

### V1b · Subtropical Belt *(operational zone — not in the realms document)*
`Bio1 18–22 · Bio12 850–1050 · NPP ~1060 · Köppen Cs/Aw/Cfa`

Mild winters, hot summers, 70 % summer-wet.

- **eHRAF**: Tupí-Guaraní · Nguni and Sotho-Tswana · Southeast Australian ·
  Southeast Chinese
- **Invariants**: reliable rain-fed agriculture without irrigation; the easiest
  farming on Selvana.
- **Variance axis**: agropastoral (Nguni: cattle as currency and kinship) vs.
  horticultural-forager (Tupí, Aboriginal SE). Same envelope, opposite worlds.

### V2 · Equatorial Ranges (sky-islands)
`Bio1 5–8 · Bio12 650–950 · NPP ~970 · Köppen ET/Cfb at |lat|<17 · elev >2000 m`
*Precipitation confidence is lowest here — see the V2 note in §2.2.*

The strongest single analogue on the planet and the smallest province (0.8 M
km²). 6.17 km summits on the equator, `ET`/`EF` crests marooned in `Af`
rainforest. Puncak Jaya is 4.88 km with glaciers at 4 °S; this is higher.

- **eHRAF**: Highland New Guinea (Enga, Dani, Chimbu) · Ecuadorian and
  Colombian highland · Ethiopian afroalpine
- **Invariants**: **tropical alpine climates cycle diurnally, not seasonally**
  — summer every day, winter every night. Consequences that transfer nowhere
  else: continuous growing season, no harvest festival, no seasonal calendar,
  no storage imperative, and a ritual year that must be built on something
  other than the sun.
- **Variance axis**: extreme valley-by-valley fragmentation is guaranteed by
  the terrain (New Guinea holds ~800 languages this way). The question is
  whether anything ever unified it, and what could.

### V3 · Interior Dry Basin
`Bio1 20–24 · Bio12 300–420 · NPP ~620 · Köppen BSh/BWh · frost-free 100 %`

Mean elevation **0.22 km** — a genuine low basin — and it **never freezes**
(cold-season mean +14.9 °C, summer 29.3 °C).

- **eHRAF**: San and Khoe (Kalahari) · Western Desert Australian · Gran Chaco ·
  Sahelian
- **Invariants**: hot-arid mobility; water points structure territory; no cold
  season means no fodder problem and no seasonal aggregation forced by winter.
- **Variance axis**: **this is not a Pontic-Caspian steppe.** That envelope
  requires −5 to −15 °C winters, and the whole logic of Eurasian steppe
  pastoralism — winter fodder, transhumance, deep-freeze storage — depends on
  a cold season this province does not have. Use Kalahari, Lake Eyre, or Chaco.
  The Pontic-Caspian analogue on this planet is **V4**.

### V4 · Southern Cordillera & Cold South
`Bio1 5–10 · Bio12 550–780 · NPP ~935 · Köppen Dfa/Dfb + BSk margin`

Cold-season −5.4 °C, warm-season 20.1 °C, 88 % above the growing threshold,
with `BSk` cold steppe on its margin and a 6.12 km wall behind it. **This is
the Ukraine–Volga profile**, about 20° further south than the analogue table
originally placed it.

- **eHRAF**: Pontic-Caspian (Yamnaya, Sredny Stog, Catacomb) · Manchurian ·
  Northern Plains · Andean-Patagonian margin
- **Invariants**: hot summer plus hard winter is the horse-analogue steppe
  envelope — mobile pastoralism, wheeled or dragged transport, winter fodder
  as the organising problem, raiding as an economy.
- **Variance axis**: whether the wall behind it makes this a *corridor* (steppe
  highway, rapid diffusion, chariot-analogue spread) or a *cul-de-sac*
  (isolated, divergent). Selvana's geometry allows either.

---

## 5. Cross-cutting notes

**Where the earliest civilisations should sit.** On Earth, domestication began
in winter-rainfall hill country (Levant, Zagros, Anatolia ~9500–8500 BCE) and
moved onto exotic rivers millennia later. That envelope on this planet is
**Meridia's NW plateau and lake country (36–50 °N)** — `Csa` 26 % / `BSk` 17 %,
winter-wet with dry summers, ~1 km elevation, mountains and freshwater lakes.
It sits inside M2/M3's boundary and deserves its own province when this
document is revised.

**The four provinces that will carry the world.** By NPP × area: **V1a**
(15.6 M NPP-units × Mkm², raw), then **S1** (12.8), **M4** (11.6) and **V1b**
(5.4) — setting aside B2, which outranks V1b on the raw product but is cold and
carries a `‡` overstated precipitation figure. By *state-formation potential*
the ranking is almost inverted — S2's starved exorheic river and M2's
storage-rich temperate coast are better bets than the productive tropics, for
the reasons given in each block.

*This ranking survives the §2 partition correction.* The top five are unchanged
in identity and order, and V1b in fact pulls further clear of V4 and S2 (its
area rose 6.8 %). The only reordering below the top five is V4 rising two
places past S2 and M2, and B1 slipping one behind S3 — B1 having lost 21 % of
its area, the largest single change the correction makes anywhere.

**The variable that matters most and is measured worst.** Precipitation
seasonality — and calibrating the scale (§2.1) did not fix it, because it is a
*censoring* problem, not a units problem. The cap flattens exactly the
distinction — ever-wet vs. monsoon — that decides whether a tropical society
can store a surplus, and therefore whether it can build a state. Where a
design decision turns on it, use the generator's Köppen class (`Af` vs `Am` vs
`Aw`), which was computed on uncapped values, and not the `Wet` column here.
Recovering the uncensored field requires re-running the generator's
precipitation module and exporting `blended / maxPrecip` before the
`Math.min(1, …)` clamp; the pattern for that already exists in
[`tools/export-v2/recover_spatial_fields.mjs`](../../tools/export-v2/recover_spatial_fields.mjs).

**Missing from the database list.** eHRAF and DYABOLA are subscription-gated;
of the tools that link *environment to coded cultural traits*, the open ones
are **D-PLACE** (georeferenced societies × environmental variables × EA/SCCS/
Binford traits), **Seshat** (~400 polities coded on social complexity over
time, for sequencing state formation), and **WALS/Glottolog** (typological
features, to keep invented languages inside attested space). D-PLACE plus
eHRAF World Cultures covers more of this project's need than the bibliographic
databases do.

---

*Generated from `data/orogen_regions_full_v2` (2,560,001 cells) using the
repository's canonical height mapping, precipitation conversion, and Miami NPP
model. Regenerate the underlying figures with the province rules in §2.*
