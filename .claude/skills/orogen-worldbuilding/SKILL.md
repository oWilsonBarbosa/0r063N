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

**The pairs are also the biological sisters.** Meridia+Selvana are the
west-flank branch, Sirocca+Borea the core (see the divergence tree below), so
each geographic pair shares deep ancestry and the Eastern Ocean is simultaneously
the widest crossing and the only cross-branch boundary on the planet.

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
`((Meridia, Selvana), (Sirocca, Borea))` — derived from the craton mapping
(AIJ Meridia · CEF Selvana · BDH Sirocca · G Borea) and the rift order R1
(T-450, west flank | core) then R3 (T-400, splitting the west flank) — with its
load-bearing hook that **kinship and reachability agree**: each sister pair is
also a hemisphere pair, and the one deep divide is the Eastern Ocean. New
regional life must descend consistently from this root.

The **biogeographic realm map** is also fixed: see `docs/life/01_BIOGEOGRAPHIC_REALMS.md`.
Four terrestrial realms (Meridian, Siroccan, Borean, Selvanan), each split into
provinces on the mountain/aridity barriers; marine realms by depth/latitude/basin
(circumglobal Abyssal, old EXT vs young rift-oceans, cold southern, upwelling
coasts). Realm **affinities follow the divergence tree, and the modern map
agrees with it** — sisters **Meridia–Selvana** (west flank, western hemisphere)
and **Sirocca–Borea** (core, eastern hemisphere) are each other's closest kin
*and* nearest neighbours, so resemblance within a hemisphere is **homology**.
The only cross-branch boundary is the **Eastern Ocean**, so resemblance across
it is **convergence**. The showcase: the three great deserts sit within 0.3 °C
of each other — M3 (Meridia, 22.3 °C / 303 mm) and V3 (Selvana, 22.1 °C /
352 mm) are cousins; S2 (Sirocca, 22.4 °C / 277 mm) is a convergent stranger.
Regional ecologies must obey this.

The **humanoid ancestry** is also fixed: see `docs/life/03_HUMANOID_ANCESTRY.md`.
The peoples are **Meridian** (west-flank branch), originating in the **AU1
aulacogen and salt-sea basin** of Meridia's southeastern interior (~15–28 °N)
on the M3/M4 ecotone — a **modern-icehouse event (T-50 → T-0)** driven by O5's
young rain shadow and an orbital lake-basin speciation pump, not a deep-time
one. The lineage is `Zoa → Thermozoa → Dendrozoa → Aulacines → crown Aulacine`.
**Iron-red blood is a west-flank invention** — the Thermozoa arose on the
west-flank stem between the T-450 and T-400 rifts, so Meridia and Selvana
inherit endothermy and **Sirocca and Borea never do: the entire core branch is
copper-blue and ectothermic.** The cradle's permanent heat is what made the
inherited trait decisive, not what minted it. There is **exactly one sapient species**, planet-wide, with
deep internal population structure and **no sister species** — the conservative
triplet code and the refilling basin prevented every split. Dispersal is
asymmetric: **Selvana** is both near and deep kin (cheap expansion — the
western hemisphere becomes one connected human world early), **Sirocca** is far
*and* cross-branch and is the trap (S2 is the planet's closest climatic match
to the Meridian homeland — 22.4 °C / 278 mm / 98 % frost-free against M3's
22.3 / 304 / 98 — with **zero** kinship, so inherited knowledge of food,
medicine and poison silently stops applying), **Borea** is last. The peoples'
endonym and everything cultural remain open.

The **chronology** is now written too: `docs/life/08_CHRONOLOGY.md` dates all of
the above. The cradle keeps a finer record than the planet does — tephra from
P5's H13–H15 field, **The Shallow** (36 m) as a cycle counter, **The Deep**
(821 m, never empties) as a continuous reference, **The Sump**'s rising salinity
as a one-way ratchet, O5's still-rising uplift as the arrow, and ice-volume
lowstands plus the age-progressive H-chains as the gate on sea crossings. All
invention is isolated into **one free parameter**, the *basin cycle*, proposed
at **100 kyr**; every date is also given in cycles so the set rescales from that
one number. Two one-way trends give two events: **the Failure (~800 kyr)**, when
O5's deepening rain shadow stops The Shallow refilling, ends 49 Myr of pumping
and **fuses** its isolates on the two surviving waters — this is the origin of
the crown species, and it is the *opposite* of a bottleneck, so the founding
population is the most diverse the planet has held and no "handful of survivors"
story is correct; and **the Surge (~200 kyr)**, when the Sump's salinity makes
the basin unusable and dispersal begins as an **expulsion**, not an achievement.
Crossings: **Selvana ~90 kyr · Sirocca ~30 kyr · Borea (onto B1) ~10 kyr.**
The load-bearing result is an inversion of Earth's shape: **regional difference
is older than continental difference** — two Meridian peoples can be more
distantly related to each other than either is to anyone in Borea. This moved
one published figure: doc 03 §4's crown species now begins at **~800 kyr**, not
T-8 Myr. The origin window (T-50 → T-0) and the lineage order did not move.

The **Meridian interval** is written: `docs/life/09_THE_MERIDIAN_INTERVAL.md`
occupies the 710 kyr — **89 % of the crown species' existence** — between the
Failure and the Selvanan crossing. **600 kyr of it (75 %) is spent on
2.24 Mkm²**: 8 % of one continent, ~2 % of the planet's land, at 100 % frost-free
and an annual range of **2.4 °C**. The Failure leaves two waters **1,362 km and
1,843 m apart** — the saline Sump and the high fresh Deep — so **long vertical
transhumance is ancestral, not invented**, and sedentism is the later novelty;
the peoples also live alongside Flushgrass and the Rainherds for 6,000 cycles
before domesticating anything. Three MEASURED results about the road out, from
the new `tools/crossings/` (gaps, stepping-stone routes, land corridors under a
height ceiling): the crossing throat is at **27.5 °N, 148.4 °W**, not the equator
— **213 km** direct but **75 km as the longest leg** once the strait's islands
are used, so the exit technology is *repeatable short-water craft*, not
seafaring; there is **no wall**, the connected low route from cradle to coast
tops out at **~1.31 km** and never enters M1, while **The Deep at 2,090 m stands
790 m higher**, so the homeland over-equipped them for their own exit; and the
departure shore is **62 % true desert**, facing V1a at NPP 1,578. The
load-bearing asymmetry: **the core goes east** into M4 (NPP 537 → 1,353, a
49.6 %-mixed ecotone) while **the founders of every other continent come from the
arid western fringe**, 5,225 km away. This annotated doc 01 §5 — "Equatorial
Western Sea" names the R3 rift's T-400 latitude, not the present water, which is
*widest* at the equator.

The **first regional ecology** is written: see
`docs/life/04_MERIDIAN_ARID_INTERIOR.md` for **M3**, the peoples' homeland.
Fixed points: M3 is **two-thirds steppe, not desert** (BSh 53.3 %, scrub is the
matrix); the survival bottleneck is **water on a schedule, never cold** (97.8 %
frost-free), so aestivation replaces hibernation and herds migrate to follow
rain rather than to escape winter; the province is **ectotherm-dominated**, with
the red-blooded Thermozoa a conspicuous minority — the Aulacines were odd at
home. The cradle holds **three of the planet's ten great lakes** at 247 m, 287 m
and 2,090 m: The Deep (821 m, permanent refuge), The Shallow (36 m, the
speciation pump), The Sump (saline, terminal). The cradle is **thermally
seasonless** (2.4 °C annual range, 100 % frost-free). Named biota:
**Ashscrub · Flushgrass · Waterstem · Sun-tuber · Saltmat · Cloudscrub** and
**Plainbacks · Stiltwaders · Sandswimmers · Rainherds · Coursers · Deepfin**.
The two domestication lines are **Flushgrass → cereal** and **Rainherd →
pack-and-milk animal**, both originating in M3 and maturing elsewhere.

The **second regional ecology** is written: `docs/life/05_SELVANAN_INTERIOR_DRY_BASIN.md`
covers **V3**, M3's homologous mirror. M3 and V3 are climate twins at
**mirror-image latitudes** (16–42 °N vs 18–40 °S; 22.3 vs 22.1 °C) from one
west-flank xeric stem, but V3 is **flat** (median 90 m vs 620 m), **twice as
seasonal** (range 14.3 vs 9.1 °C), **monotonous** (BSh 85.2 % vs 53.3 %), and has
**no permanent deep water** (Selvana holds none of the planet's ten great lakes;
its deepest is 44 m against The Deep's 821 m). So V3 has **no speciation pump**:
same ancestry, opposite diversity structure — M3 many species with small ranges
and ancient relicts, V3 few species with huge ranges and none. Congeners:
**Palescrub · Coldflush · Pan-tuber · Broadbacks · Basinherds · Longcoursers**;
**Cloudscrub and Deepfin are absent**. Two results to carry forward: V3 organisms
time on **cooling as well as wetting**, so a Meridian planting calendar misfires
there even though the crops transfer; and **V3 could not have produced the
peoples** — it has the climate and the stock but none of doc 03 §2's three
geological requirements, which is what makes the cradle's geology, not its
climate, responsible.

The **third regional ecology** is written: `docs/life/06_SIROCCAN_ARID_HEART.md`
covers **S2**, the convergent stranger — and returns the framework's sharpest
result. On six structural axes (annual range, median and p95 elevation, scrub
share, desert share, interdigitation) **S2 is M3's nearest twin, closer than
M3's actual cousin V3**: median elevation 630 m vs M3's 620 (V3: 90), range
9.5 vs 9.1 (V3: 14.3), 52.8 % mixed bins vs 49.6 % (V3: 60.8 %). Kinship is not
readable from appearance — the two deserts that look alike are the two that are
not related. S2 is also the largest, driest and least productive of the three
(12.08 Mkm², 277 mm, NPP 498, BW 40.2 %). It holds **three great lakes, deepest
14 m** against the cradle's 821 m — a speciation pump with **no refuge**, giving
high richness, **no relicts**, and survival banked in desiccation-resistant
propagules. The convergent set is **Thornmat · Sparkgrass · Ashen-root ·
Bloatstem · Panmat · Dustbacks**, with **Ashen-root** (a Sun-tuber look-alike
defended by a bitter alkaloid) the single most dangerous object in the province
to a Meridian forager. And **S2 has no endotherms at all**, so nothing follows
the rain and the peoples' own red blood is the wrong colour for the continent.

This completes the desert experiment (M3 · V3 · S2). Note also a correction it
forced on doc 03 §1: Sirocca was originally dismissed as "aridity without the
mosaic", which the data contradicts — Sirocca has the climate, relief, ecotone
and scale, and loses only on **permanent deep water**.

The **fourth regional ecology** is written:
`docs/life/07_BOREAN_SOUTHERN_MARITIME_COAST.md` covers **B1**, the first
non-desert and first core-branch cold province, and finds **the hardest
ecological line on the planet**: only **31.7 %** of B1's 2° bins also hold its
neighbour B2, against 70.2 / 79.6 / 72.9 % for M3 / V3 / S2 (symmetric share
5.0 % vs 49.6–60.8 %). There is **no wall on it** — the border band averages
380 m and 2.2 % mountain cells. The mechanism is instead **phenological**: a
Köppen C/D thermal threshold (frost-free **100 % → 0.2 %** across one bin)
compounded by a **seasonality inversion** (winter-wet **72.0 % → 28.3 %**)
that is at its maximum exactly along the line, so a lineage crossing it arrives
with its dormancy timed to the wrong half of the year. B1 also contains its own
reversal at ~32 °N — a winter-wet Mediterranean north (67.6 %) against a
summer-wet subtropical south (20.6 %). It is **15.6 % of Borea holding 98.7 %
of its frost-free land**, which makes it the **ancestral** refuge and B2/B3 the
**derived** provinces, holding the continent's real innovation: freeze
tolerance, in a world with no endotherms. Set: **Hardleaf · Coastwood ·
Winterseed · Drybulb · Tidemat · Leafbacks · Duskrunners · Winterspawn**, plus
**Frostbacks** across the line, on a **bimodal annual cycle** (two dormancies a
year) unique to this province. For the culture layer it is a **second,
independent cereal cradle** (Winterseed) with **no animal to pair with it**:
husbandry as larder, not as herd, and no plough without an import. It corrected
four figures in `docs/culture/00` §4's B1 block and the stale B2 frost-free
figure in doc 03.

**Partition correction — adopted** (doc 05 §7 found it; `docs/culture/README.md`
records the adoption). The old longitude-based continent proxy dropped
1.80 Mkm² of land (1.69 % of all land) and undercounted **Selvana by 5.1 %**
against `reports/tectonics/inventory.json`. It has been **replaced** by a
connected-landmass assignment — `tools/continents.mjs`, a port of the tectonics
pipeline's own `lib/continents.py`, reproducing the authoritative areas to
within 0.27 Mkm² — which is now the **default** in both Node tools and the
basis of the **regenerated** master table. `--continents proxy` reproduces the
superseded table, and `node tools/province-vectors/validate-continents.mjs`
prints the per-province delta. The whole repository now partitions the planet
one way. The correction moved **B1 −21 %** (the largest on the planet),
V4 +15.2 %, M4 −9.6 %; M3 and V3 moved ≤ 2.3 % and no climate figure in
docs 04–05 changed. The table also gained an **Islands** accounting row
(4.03 Mkm²) which is explicitly *not* a design envelope.

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
  era by era from origin to the present realms (`02`), the humanoid
  ancestry that seats the peoples in Meridia's AU1 trough (`03`), and the
  four regional ecologies — the planet's three great deserts, **M3** (`04`),
  **V3** (`05`) and **S2** (`06`), and the first cold province, **B1** (`07`).
  Start here before designing any flora, fauna, or people. Regional ecologies
  are the T-0 cross-section of the doc-02 history, written one province at a
  time with `03` §8 as the design brief. **`08` and `09` are not regional
  ecologies**: `08` is the chronology (the Failure at ~800 kyr, the Surge at
  ~200 kyr, the crossings at ~90 / ~30 / ~10 kyr) and `09` is the Meridian
  interval — the 710 kyr before the first crossing, and the measured road out.
  `10+` are still open (next: **V1a**, the planet's richest province and the far
  side of `09`'s crossing; then **B2**, which `07` runs up a debt to, or **M4**).
- **Province profiler** — `tools/province-ecology/main.mjs <PROVINCE>` streams
  the raw export and reports any province's Köppen/terrain composition,
  seasonal water and temperature regime, frost-free share, NPP and elevation
  spread (`--box` for a sub-region, `--compare` for interdigitation with a
  neighbour). Run it before writing any new regional ecology.
- **Crossings** — `tools/crossings/main.mjs --pair A,B` describes the *water*
  between landmasses, which is what gates dispersal: the narrowest coast-to-coast
  gap and where it is, that gap by latitude (so a "narrow sea" can be checked
  against the latitude its name claims), `--hops` to re-solve the crossing with
  islands as stepping stones **minimising the longest single leg** rather than
  total distance, `--corridor --from --to` to test whether two points are joined
  by land under a height ceiling and find the pass, and `--shore` for a departure
  coast's Köppen. Run it before asserting that anything is near, far, walled off,
  or reachable.
- **Data caveats** — `reports/audit/README.md`. The ones that matter for
  worldbuilding: `pS/pW`, `wsS/wsW`, `ocSpeed*` are p95-capped indices (1
  means "at or above the 95th percentile", so extreme rainfall/wind figures
  are floors); `isCoastal` is a tectonic flag — use `isSurfaceCoast` for the
  real coastline; ocean-current warmth cannot be read from `owS/owW`.

For queries needing specific cell data (e.g. "find all cells in Selvana above
2 km with tropical climate"), query the v2 CSV parts directly — each part is
independently readable with the full header.
