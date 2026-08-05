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

**Use it backwards too.** The regional ecologies (`../life/03+`) and the
humanoid-ancestry document are still unwritten. The subsistence *requirements*
that fall out of step 4 are a design brief for those documents: if a province's
envelope demands a herdable, cellulose-converting, cold-tolerant animal, that
is a specification the biology layer has to fill.

---

## 2. Method and its limits

Read these before trusting a number.

| Quantity | How it is derived | Limit |
|---|---|---|
| Height | Canonical Earth-fitted power mapping of raw `elev` (`tools/height-mapping.mjs`), **not** the legacy `elev_km` column | Differs from the climate model's internal S-curve by ~0.35 km mean; see [`relief_coast_diagnostic`](../../reports/audit/relief_coast_diagnostic/README.md) |
| Temperature | `°C = -45 + t × 90` on `tS`/`tW` | **Two seasons, not twelve.** "Cold-season mean" is not the coldest *month*; true monthly extremes are colder |
| Precipitation | `(pS + pW) × 1000` mm/yr — the repo's canonical conversion (`classify.mjs`) | **Hard-capped at 2,000 mm/yr**, because `pS`/`pW` are p95-capped indices. Wet tropics are *understated*: V1a's 1,441 mm is a floor, not a measurement |
| Wet-season share | `max(pS,pW) / (pS+pW)` | Same cap compresses the ratio. Use the Köppen class as the authority on seasonality — `Af` vs `Aw` vs `Am` is computed by the generator on uncapped values |
| NPP | Miami model, `min(3000/(1+e^(1.315−0.119T)), 3000(1−e^(−0.000664P)))` g/m²/yr | Inherits the precipitation cap; wet-tropical NPP is a floor |
| Growing season | % of province area with warm-season mean ≥ 10 °C (Köppen tree-line criterion) | A proxy for *extent*, not *length in days* |
| Frost-free | % of area with cold-season mean > 0 °C | Two-season data hides monthly frost; treat as optimistic |

**Province boundaries are operational.** The fourteen provinces are those of
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

Offshore land in the western hemisphere below 16°S is excluded from Meridia as
islands rather than continent.

---

## 3. The master table

Area in millions of km². Temperatures °C. Precipitation mm/yr. NPP g/m²/yr.
"Wet" = share of annual precipitation falling in the wetter season.

| Province | Area | Lat (5–95 %) | Elev mean / max | >2 km | T cold | T warm | T ann | Precip | Wet | NPP | Frost-free | Growing | Coastal |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **M1** W. Cordillera & Central Massif | 5.1 | 10–58 N | 2.99 / 7.66 | 100 % | −12.2 | −1.1 | −6.7 | 384 | 60 % | 368 | 21 % | 25 % | 0.0 % |
| **M2** Northern Cold Highlands | 5.3 | 46–63 N | 0.54 / 2.0 | 0 % | 0.1 | 20.7 | 10.4 | 1002 | 58 % | 1168 | 53 % | 95 % | 8.4 % |
| **M3** Arid Interior Plateau | 9.5 | 16–42 N | 0.75 / 2.0 | 0 % | 17.7 | 26.8 | 22.3 | 374 | 65 % | 645 | 98 % | 100 % | 3.7 % |
| **M4** S. Tropical Lowlands & SW Trunk | 9.5 | 7 S–43 N | 0.53 / 2.0 | 0 % | 21.5 | 25.7 | 23.6 | 1206 | 64 % | 1576 | 96 % | 100 % | 13.0 % |
| **S1** Northern Range & SW Wet Coast | 11.5 | 4–49 S | 0.87 / 6.98 | 17 % | 15.0 | 22.0 | 18.5 | 1036 | 60 % | 1358 | 87 % | 87 % | 9.9 % |
| **S2** The Arid Heart | 12.1 | 21–46 S | 0.80 / 2.8 | 5 % | 17.6 | 27.1 | 22.4 | 341 | 64 % | 598 | 98 % | 100 % | 1.1 % |
| **S3** Southern Cold Fringe | 4.7 | 50–74 S | 0.77 / 4.7 | 11 % | −2.3 | 13.7 | 5.7 | 1117 | 54 % | 999 | 47 % | 71 % | 16.3 % |
| **B1** Southern Maritime Coast | 4.0 | 26–45 N | 0.19 / 1.5 | 0 % | 7.9 | 26.6 | 17.2 | 789 | 70 % | 1089 | 100 % | 100 % | 19.4 % |
| **B2** Subarctic Interior | 12.9 | 47–72 N | 0.44 / 1.5 | 0 % | −10.5 | 14.9 | 2.2 | 1028 | 59 % | 793 | 1 % | 66 % | 7.1 % |
| **B3** E. Range & N. Ice Highlands | 4.3 | 51–77 N | 1.96 / 6.12 | 42 % | −28.5 | −5.2 | −16.8 | 598 | 60 % | 166 | 0 % | 9 % | 2.0 % |
| **V1a** Tropical North | 10.0 | 13 S–19 N | 0.39 / 2.0 | 0 % | 23.6 | 25.7 | 24.7 | 1441+ | 64 % | 1810+ | 100 % | 100 % | 11.7 % |
| **V1b** Subtropical Belt *(operational)* | 4.7 | 16–41 S | 0.33 / 5.5 | 3 % | 12.7 | 26.7 | 19.7 | 838 | 70 % | 1225 | 95 % | 97 % | 6.4 % |
| **V2** Equatorial Ranges (sky-islands) | 0.8 | 17 S–14 N | 2.63 / 6.17 | 100 % | 3.0 | 10.0 | 6.5 | 928 | 70 % | 1055 | 68 % | 58 % | 0.1 % |
| **V3** Interior Dry Basin | 4.8 | 18–40 S | 0.22 / 2.2 | 0 % | 14.9 | 29.3 | 22.1 | 433 | 68 % | 743 | 100 % | 100 % | 1.7 % |
| **V4** Southern Cordillera & Cold South | 5.6 | 43–60 S | 0.72 / 6.12 | 9 % | −5.4 | 20.1 | 7.3 | 941 | 59 % | 1020 | 21 % | 88 % | 5.0 % |

`+` marks a value suppressed by the 2,000 mm precipitation cap.

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
`Bio1 −10…0 · Bio12 300–500 · NPP <400 · Köppen EF/ET · elev >2000 m`

High, cold, dry, and 100 % above 2 km — 93 % of the land over 3 km is `EF` ice.
Terrestrial NPP of 368 is at the edge of what supports year-round occupation.

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
`Bio1 8–13 · Bio12 900–1100 · NPP ~1150 · Köppen Cfa/Cfb/Dfb`

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
`Bio1 20–25 · Bio12 300–450 · NPP 600–700 · Köppen BSh/BWh · frost-free`

Hot semi-desert that never freezes, and holds the planet's deep salt sea
(206,469 km², 218 m deep, 17.3 °N 101.8 °W) — a **Caspian**, not a playa.

- **eHRAF**: Saharan and Sahelian pastoral · Arabian bedouin · Hohokam and
  Sonoran · Rajasthan / Thar
- **Invariants**: water rights are the constitution; mobility is capital;
  storage is against drought, not winter.
- **Variance axis**: a deep permanent inland sea is *not* the Sahara case. It
  supports fisheries, shipping, and a shoreline city belt in the middle of a
  desert — closer to the Caspian littoral or the Aral before 1960. Decide
  whether the sea unifies the plateau or divides it.

### M4 · Southern Tropical Lowlands & SW Trunk River
`Bio1 22–25 · Bio12 1100–1300 · NPP ~1600 · Köppen Aw/Am/Cfa`
*Broad province — split before use.*

Contains the SW trunk river: 1,980 km, **597 km³/yr**, mouth 5.7 °S 85.4 °W
onto a delta that is 49 % `Aw` / 29 % `BSh`, one wet season.

- **eHRAF**: Indus (Harappan) · Ganges Neolithic and Painted Grey Ware ·
  mainland Southeast Asian riverine · Orinoco/llanos
- **Invariants**: annual flood pulse sets the calendar; delta agriculture with
  a dry hinterland; natural port at the mouth.
- **Variance axis**: the Indus analogue is imperfect — 597 km³/yr is 3–6× the
  Indus, so this river is *not* marginal and the "civilisation clinging to one
  thread" story is unavailable. Water this abundant historically produces
  dispersed, less coercive polities. If you want a hydraulic despotism on this
  planet, it belongs on S2's starved river, not here.

### S1 · Northern Range & SW Wet Coast
`Bio1 16–21 · Bio12 950–1150 · NPP ~1350 · Köppen Af/Cfb + elev >2000 m band`

A 6.98 km near-equatorial wall against the continent's only reliable maritime
margin. Includes the 3,243 km / **1,353 km³/yr** river reaching the sea at
11.7 °S 40.8 °W into 78 % `Af` rainforest — a Congo, not a Nile.

- **eHRAF**: Central Andean (Chavín, Moche, Wari) · Ethiopian highland ·
  Highland and coastal New Guinea
- **Invariants**: extreme vertical compression of ecozones over short
  horizontal distance; complementary-zone exchange is nearly forced.
- **Variance axis**: whether verticality is managed by one polity holding all
  tiers (Andean "vertical archipelago") or by trade between tier-specialised
  peoples (New Guinea). This is the single richest design decision on Sirocca.

### S2 · The Arid Heart
`Bio1 20–25 · Bio12 300–400 · NPP ~600 · Köppen BSh/BWh · endorheic`

The most distinctive province on the planet. 12.1 M km², 1.1 % coastal, and
drained by **2,300–3,400 km rivers that all die in a terminal salt lake** at
~28 °S 43 °E. It also holds the Nile-profile river — 4,082 km, **56 km³/yr**,
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
`Bio1 4–8 · Bio12 1000–1200 · NPP ~1000 · Köppen Cfb/Cfc/ET · ET (Binford) low`

Cool, wet, oceanic, 16.3 % coastal — the highest coastal fraction of any
province.

- **eHRAF**: Fuegian (Yámana, Selk'nam) · Chono and Chilean archipelago ·
  Norse North Atlantic · Aleut
- **Invariants**: marine subsistence dominates; boats are infrastructure, not
  transport; fuel and shelter are year-round problems at 47 % frost-free.
- **Variance axis**: maritime foragers (Fuegian: mobile, egalitarian, canoe-
  based) vs. maritime farmers (Norse: sedentary, stratified, livestock on a
  thin margin). NPP 999 permits either.

### B1 · Southern Maritime Coast
`Bio1 15–20 · Bio12 700–900 · NPP ~1100 · Köppen Cfa · frost-free 100 %`

Borea's warm refuge — 26–45 °N, never freezes, summer-wet, 19.4 % coastal. On
a continent that is 81 % D+E, this is the anomaly that will hold most of its
people.

- **eHRAF**: Jōmon and Yayoi · Southeast Chinese Neolithic (Hemudu, Liangzhu) ·
  Southeastern US Woodland/Mississippian
- **Invariants**: the only part of Borea where agriculture is easy; a
  population sink for the whole continent; sharp gradient inland.
- **Variance axis**: whether it is Borea's core or Borea's frontier — is the
  cold interior a hinterland this coast exploits, or a rival that raids it?

### B2 · Subarctic Interior
`Bio1 0–4 · Bio12 950–1100 · NPP ~800 · Köppen Dfc/Dfb · frost-free 1 %`

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
`Bio1 <−15 · NPP <200 · Köppen EF · elev mean ~2000 m`

**A 2 km ice dome, not an Arctic coast** — mean elevation 1.96 km, 42 % above
2 km, mean −16.8 °C, NPP 166. The Earth analogue is the Greenland ice sheet
(mean ice elevation 2.1 km, interior ≈ −20 °C), not Yamal or Chukotka.

- **eHRAF**: Thule and Inuit (margins only) · Chukchi · Tibetan Changtang
- **Invariants**: NPP 166 means essentially no terrestrial production. Anyone
  here is marine-subsidised, transient, or dead. There is no indigenous
  agriculture and no year-round interior settlement.
- **Variance axis**: none worth designing in the interior. Design the *edge* —
  who crosses it, why, and what they believe is on top.

### V1a · Tropical North
`Bio1 23–26 · Bio12 >1400 · NPP >1800 · Köppen Af/Am/Aw · frost-free 100 %`

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
`Bio1 18–22 · Bio12 800–900 · NPP ~1200 · Köppen Cs/Aw/Cfa`

Mild winters, hot summers, 70 % summer-wet.

- **eHRAF**: Tupí-Guaraní · Nguni and Sotho-Tswana · Southeast Australian ·
  Southeast Chinese
- **Invariants**: reliable rain-fed agriculture without irrigation; the easiest
  farming on Selvana.
- **Variance axis**: agropastoral (Nguni: cattle as currency and kinship) vs.
  horticultural-forager (Tupí, Aboriginal SE). Same envelope, opposite worlds.

### V2 · Equatorial Ranges (sky-islands)
`Bio1 5–8 · Bio12 ~930 · NPP ~1050 · Köppen ET/Cfb at |lat|<17 · elev >2000 m`

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
`Bio1 20–24 · Bio12 400–500 · NPP ~750 · Köppen BSh/BWh · frost-free 100 %`

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
`Bio1 5–10 · Bio12 900–1000 · NPP ~1000 · Köppen Dfa/Dfb + BSk margin`

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

**The four provinces that will carry the world.** By NPP × area: V1a (18.1 M
NPP-units × Mkm²), M4, S1, V1b. By *state-formation potential* the ranking is
almost inverted — S2's starved exorheic river and M2's storage-rich temperate
coast are better bets than the productive tropics, for the reasons given in
each block.

**The variable that matters most and is measured worst.** Precipitation
seasonality. The cap flattens exactly the distinction — ever-wet vs. monsoon —
that decides whether a tropical society can store a surplus, and therefore
whether it can build a state. Where a design decision turns on it, use the
generator's Köppen class (`Af` vs `Am` vs `Aw`), which was computed on
uncapped values, and not the `wet %` column here.

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
