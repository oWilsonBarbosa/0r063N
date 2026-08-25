---
name: orogen-worldbuilding
description: >
  Worldbuilding compendium for a procedurally generated secondary world planet
  (World Orogen, Planet #06cy8w6z6a89kow6psje93, seed 10673275). Always use
  this skill when the conversation involves the planet's geography, any of the
  four continents (Meridia, Sirocca, Selvana, Borea), climate zones, terrain,
  peoples, cultures, civilizations, species placement, story settings,
  narrative hooks, or any creative worldbuilding grounded in the planet's
  physical data. Also trigger for questions like "where would X people live",
  "what climate suits Y culture", "find a location for Z story", or "design a
  humanoid adapted to region X".
---

# Orogen Worldbuilding Compendium

## Planet Identity

**Planet #06cy8w6z6a89kow6psje93** — procedurally generated secondary world
(World Orogen generator, seed 10673275).

- Ocean-dominated: **20.89 % land / 79.11 % ocean**
- Four major continents = **96.4 %** of all land; 1,471 islands share the rest
- Mild maritime baseline with dramatic exceptions: Himalaya-class mountain walls, vast arid interiors, polar ice
- 80 tectonic plates (16 continental, 64 oceanic) grouped into 20 superplates
- Physical relief: **−9.28 km** (deepest trench) to **+7.66 km** (planet peak, Meridia; canonical Earth-fitted power mapping — see Key Locked Facts)
- **Phase 5 status**: all physical geography is locked canon. Societies, cities, cultures, history, planet name, and calendar are fully open — not yet created.

### Canonical dataset

All numbers in this skill are measured from the corrected v2 export in
repository `oWilsonBarbosa/0r063N`: `data/orogen_regions_full_v2/`
(2,560,001 cells × 58 fields; see `docs/DATA_DICTIONARY_V2.md`). An earlier
version of this skill used a low-resolution export of the *same world*
(identical seed and generation parameters, code `06cy8vf7zvurfgpbrgnm4l`,
591k-cell mesh); the high-resolution export supersedes it — same continents
and climate story, refined statistics. Continent stats below were computed by
`tools/export-v2/continent_stats.mjs` using the **canonical Earth-fitted power
height mapping** (see the Key Locked Facts note).

---

## The Four Continents

### Meridia — the high meridional western continent

- **Extent**: 67°N → 15°S · area ~28.1 M km² (largest)
- **Elevation**: mean **1.08 km** (highest continent) · peak **7.66 km** at ~29°N (Central Massif — planet's highest point) · **18.2 %** of its land above 2 km (most mountainous)
- **Climate**: A 25 % · **B 36 %** · C 16 % · D 9 % · E 15 % · mean temp 15.3 °C
- **Shape**: NW–SE spine. Western Collision Front + Central Massif form the backbone. East of them: Arid Interior Plateau (dry, leeward, dominant). Far north: Cold Highlands (subarctic). South: Tropical Lowlands.
- **Water**: SW Trunk River + coastal delta (main artery, natural port); NW freshwater lakes (structural gift in an otherwise dry plateau interior)
- **Story character**: the planet's rooftop. A continent of extremes — the highest wall on one side, driest plateau behind it, tropical fringe below. Everything of importance happens in relation to the mountain barrier or the river that escapes it.
- **Story hooks**: passes through the 7.7 km wall · salt pan oasis economies · SW river delta as port capital · NW lakeland as contested water source · subarctic northern frontier

---

### Sirocca — the arid southern continent

- **Extent**: ~1°N → 76°S · area ~27.4 M km²
- **Elevation**: mean **0.85 km** · peak **6.98 km** at ~24°S (Northern Range) · **11.3 %** above 2 km
- **Climate**: A 20 % · **B 44 %** · C 21 % · D 5 % · E 10 % · mean temp 18.2 °C
- **Shape**: Northern Range wall (subtropical, ~7 km) → Vast Arid Heart (salt sea, playas, endorheic basins) → Southern Cold Fringe. SW wet coast is the only reliable maritime zone.
- **Water**: Northern River corridor (desert-to-sea lifeline — the continent's most critical through-route); equatorial-zone lakes; Salt Sea (endorheic, saline)
- **Story character**: almost half the continent is Köppen B. Arid is not an exception here — it is the norm. The Northern River is the artery everything else depends on.
- **Story hooks**: desert caravan economies · contested oases and water rights · salt trade · Northern River as political spine · Northern Range passes between wet coast and arid interior · subtropical snowfields on the 7 km crest (dramatic, rare)

---

### Selvana — the green tropical southern continent

- **Extent**: ~28°N → 64°S · area ~27.2 M km²
- **Elevation**: mean **0.49 km** (lowest / flattest continent) · peak **6.17 km** at ~2°N (Equatorial Ranges) · **5.2 %** above 2 km
- **Climate**: **A 40 %** · B 21 % · C 18 % · D 17 % · E 4 % · mean temp 18.5 °C
- **Shape**: Tropical North (wet, lush) → Equatorial Ranges (spine, carrying the continent's highest summits) → Interior Dry Basin (rain shadow, salt lake) → Southern Cordillera (cold southern wall). NE and Northern coasts open onto warm equatorial sea.
- **Water**: NE and Northern river deltas (tropical gateways, high maritime traffic); plateau lakes in Interior Dry Basin; Southern Cordillera freshwater from glacial melt
- **Story character**: the most tropical and most accessible of the four continents — and also the flattest. The western pair's gateway from the sea. The Equatorial Ranges split it; the Cordillera closes the south.
- **Story hooks**: tropical maritime gateway cultures · equatorial highland peoples under 6 km snow summits on the equator · interior dry basin pastoralists · the southern cape route around the Cordillera's eastern end · easy contact with Meridia across the warm Equatorial Western Sea

---

### Borea — the cold northern continent

- **Extent**: ~23°N → 79°N · area ~20.1 M km² (smallest)
- **Elevation**: mean **0.73 km** · peak **6.12 km** at ~60°N (Eastern Range / Northern Ice Highlands) · **9.0 %** above 2 km
- **Climate**: A 0 % · B 3 % · C 13 % · **D 43 %** · **E 41 %** — **D+E = 84 %** · mean temperature **0.4 °C**
- **Shape**: Southern maritime coast (warmest zone, C-group) → Subarctic Interior → Eastern Range → Northern Ice Highlands (ice cap, polar edge; the high-latitude interior is the "far north", not the geographic poles which are maritime)
- **Water**: Western and Eastern snowmelt rivers (taiga highways; seasonal flooding governs agricultural and transport calendar)
- **Story character**: the only continent defined entirely by cold — by latitude, not by relief (its mean elevation is modest, ~0.73 km, though its high massifs top 6 km). Sparse, seasonal, materially distinct from all other continents. A different relationship with land, time, and survival.
- **Story hooks**: cold-specialist peoples and material culture · seasonal settlement calendars · glacially carved harbours on southern coast · snowmelt rivers as the only highways · Northern Ice Highlands as polar frontier · starkly contrasting with tropical-arid Sirocca (its eastern pair neighbour)

---

## Continental Pairs and Inter-Continental Contact

| Pair | Continents | Sea | Contact difficulty |
|---|---|---|---|
| Western | Meridia + Selvana (nearly meet at equator) | Equatorial Western Sea (warm, narrow) | Easy |
| Eastern | Borea (north) + Sirocca (south, reaching to the equator) | Tropical ocean | Moderate — requires sea crossing; climatically opposite |
| Cross-ocean | Western pair → Eastern pair | Eastern Ocean (broad, open) | Hard — **planet's defining long-distance voyage** |

---

## The Two Planet-Wide Narrative Threads

### Thread 1 — Arid rain-shadow interiors
**27 % of all land is Köppen B.** Once you leave any maritime coast, arid is
the default. The major mountain walls intercept moisture from westerlies and
trade winds, creating map-scale rain shadows (~1,000–1,500 km wide). Terminal
salt pans, endorheic basins, oasis corridors. Water is the currency that
shapes everything inland.

### Thread 2 — Snow-crowned mountain walls
**10.7 % of land lies above 2 km**, and the high fronts are dramatic:
Himalaya-class walls on every continent — the planet's peak of **7.66 km** in
subtropical Meridia, **~7 km** in subtropical Sirocca, and **~6 km** summits on
the equator (Selvana). Passes through these walls are history-defining
chokepoints. Glacial U-valleys, sharpened ridges, permanent snowfields.
(Physical height uses the canonical Earth-fitted power mapping; see the note
under Key Locked Facts.)

---

## Key Locked Facts

| Metric | Value |
|---|---|
| Land / ocean split | 20.89 % / 79.11 % |
| Major continents | 4 (= 96.4 % of all land) · 1,471 islands |
| Tectonic plates | 80 (16 continental, 64 oceanic) · 20 superplates |
| Planet peak | 7.66 km (Meridia, Central Massif, ~29°N) |
| Deepest ocean | −9.28 km |
| Continental peaks | Sirocca 6.98 · Selvana 6.17 · Borea 6.12 km |
| Highest continent (mean) | Meridia 1.08 km · then Sirocca 0.85 · Borea 0.73 · Selvana 0.49 |
| Borea mean temperature | 0.4 °C (D+E = 84 %) |
| Meridia mean temperature | 15.3 °C |
| Global arid (B-group) | 27 % of land |
| Sirocca B share | 44 % |
| Meridia B share | 36 % |
| Selvana A (tropical) | 40 % |
| Land above 2 km | 10.7 % (Meridia 18.2 % · Sirocca 11.3 % · Borea 9.0 % · Selvana 5.2 %) |

> **Height mapping note.** Physical height in km is the repository's canonical
> **Earth-fitted power** mapping of the raw `elev` (`4.574·elev^1.462`; ocean
> `10·elev`), fitted to an Earth-like land distribution (median ~0.42 km,
> ~10.7 % of land ≥ 2 km, peak ~7.66 km). The stored `elev_km` column is a
> legacy *linear* mapping (peak 8.54 km) and is **not** canonical. The
> generator's exported climate (temperature, Köppen, precip, winds) was computed
> on the generator's own internal S-curve profile and is preserved as published;
> it differs from the reported relief by ~2 °C mean (a documented, accepted seam —
> within model error, so it shifts no climate zones). See
> `docs/DATA_DICTIONARY_V2.md` and `reports/audit/relief_coast_diagnostic/`.

---

## Phase 5 Worldbuilding Rules

### Locked (physical canon — do not invent or contradict)
Continent shapes, coastlines, mountain belts, climate zones, trunk river courses, major lake placements, elevation ranges, tectonic structure, ocean basins.

### Derived (use at trunk scale only, not exact geography)
River lengths and exact courses, lake counts, drainage basin details — modelled at raster scale; correct at major-river scale, not local geography.

### Established life canon (invented, but now fixed — build on it, don't contradict)
The **tree of life** is written: see `docs/life/`. Fixed points a worldbuilder
must respect — single marine origin at hydrothermal vents; water/carbon
biochemistry; a **two-pigment palette (violet seas, green land)**; three
ancestral domains and a single complex-cell origin; four founding kingdoms and
a bilaterian, blue-blooded, internal-skeleton **Zoan animal plan**; the
icehouse-bottleneck → hothouse-radiation → dispersal timeline pegged to the
geological/climate record; and the **continental divergence tree**
`((Meridia, Sirocca), (Borea, Selvana))` with its load-bearing hook that
biological sisters are *not* the easy-to-sail neighbours. New regional life
must descend consistently from this root.

The **biogeographic realm map** is also fixed: see `docs/life/01_BIOGEOGRAPHIC_REALMS.md`.
Four terrestrial realms (Meridian, Siroccan, Borean, Selvanan), each split into
provinces on the mountain/aridity barriers; marine realms by depth/latitude/basin
(circumglobal Abyssal, old EXT vs young rift-oceans, cold southern, upwelling
coasts). Realm **affinities follow the divergence tree, not the modern map** —
sisters Meridia–Sirocca and Borea–Selvana share deep lineages across the ocean
(homology), while easy-to-sail neighbours Meridia–Selvana and Borea–Sirocca are
cross-branch (convergence). Regional ecologies must obey this.

The **humanoid ancestry** is also fixed: see `docs/life/03_HUMANOID_ANCESTRY.md`.
The peoples are **Meridian** (west-flank branch), originating in the **AU1
aulacogen and salt-sea basin** of Meridia's southeastern interior (~15–28 °N)
on the M3/M4 ecotone — a **modern-icehouse event (T-50 → T-0)** driven by O5's
young rain shadow and an orbital lake-basin speciation pump, not a deep-time
one. The lineage is `Zoa → Thermozoa → Dendrozoa → Aulacines → crown Aulacine`,
with **iron-red blood** derived from the cradle's heat in an otherwise
copper-blue world. There is **exactly one sapient species**, planet-wide, with
deep internal population structure and **no sister species** — the conservative
triplet code and the refilling basin prevented every split. Dispersal is
asymmetric: **Selvana** is reachable but cross-branch (convergent, misleading),
**Sirocca** is Meridia's deep kin across the widest ocean (the prize — its arid
biota is genuinely usable by a Meridian people), **Borea** is last. The
peoples' endonym and everything cultural remain open.

### Open (Phase 5 creative space — fully yours to invent)
Planet name · continent names (Meridia/Sirocca/Selvana/Borea are provisional working labels) · all societies, cultures, languages · cities and settlements · human history and mythology · calendar, day length, moon system, gravity · concrete regional ecologies (grounded in `docs/life/`) · any minor rivers and local geography

### Label conventions when worldbuilding
- `MEASURED` — directly from the v2 export (elevation, temperature, Köppen)
- `DERIVED` — from physical model (trunk hydrology, lake placements)
- `INTERPRETED` — inference consistent with data (settlement pressure, trade routes)
- `INVENTED` — your creative addition (peoples, names, events)

---

## Using the Knowledge Base

Everything lives in repository `oWilsonBarbosa/0r063N`:

- **Raw data** — `data/orogen_regions_full_v2/` (13 csv.gz parts, 58 fields
  per cell: lat/lon in degrees, elev_km, koppen, tS/tW, pS/pW, winds,
  currents, plates, `isSurfaceCoast`, …). Column reference:
  `docs/DATA_DICTIONARY_V2.md`.
- **Physical atlas** — `reports/regional/atlas/` (13 global plates: relief,
  erosion, plates, Köppen, temperature, precipitation, winds, currents,
  basins, NPP + records gazetteer).
- **Regional gazetteers** — `reports/regional/regions/` (20 chapter-style
  write-ups with maps: terrain classes, hydrology, climate per region).
- **Deep history** — `docs/GEOLOGICAL_HISTORY.md` and `docs/PALEOCLIMATE.md`
  (750-Myr reconstructed plate/climate history; narrative canon for myths of
  deep time).
- **Life layer** — `docs/life/`: the founding tree (`00`), the biogeographic
  realm map (`01`), the deep-time paleobiology that runs the biology forward
  era by era from origin to the present realms (`02`), and the humanoid
  ancestry that seats the peoples in Meridia's AU1 trough (`03`). Start here
  before designing any flora, fauna, or people; regional ecologies (`04+`,
  not yet written) are the T-0 cross-section of the doc-02 history, and
  `03` §8 is the design brief for them.
- **Data caveats** — `reports/audit/README.md`. The ones that matter for
  worldbuilding: `pS/pW`, `wsS/wsW`, `ocSpeed*` are p95-capped indices (1
  means "at or above the 95th percentile", so extreme rainfall/wind figures
  are floors); `isCoastal` is a tectonic flag — use `isSurfaceCoast` for the
  real coastline; ocean-current warmth cannot be read from `owS/owW`.

For queries needing specific cell data (e.g. "find all cells in Selvana above
2 km with tropical climate"), query the v2 CSV parts directly — each part is
independently readable with the full header.
