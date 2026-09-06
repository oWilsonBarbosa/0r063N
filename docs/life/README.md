# The life layer

Biology for planet `06cy8w6z6a89kow6psje93`, built on top of the locked
physical canon (`data/`, `reports/`, and the deep-time record in
`../GEOLOGICAL_HISTORY.md` / `../PALEOCLIMATE.md`).

The layer is built **root-first**: the origin of life and the founding
lineages come before any continent's ecology, so that every regional flora and
fauna descends from one consistent tree and the four continents' biotas relate
to each other correctly.

| # | Document | Scope | Status |
|---|---|---|---|
| 00 | [`00_TREE_OF_LIFE.md`](00_TREE_OF_LIFE.md) | Origin of life, core biochemistry, the ancestral domains and founding kingdoms, and the deep timeline pegged to the geological/climate record | **done** |
| 01 | [`01_BIOGEOGRAPHIC_REALMS.md`](01_BIOGEOGRAPHIC_REALMS.md) | The realm map: four terrestrial realms + provinces, the marine realms, and the affinity rules — which biotas share deep ancestry vs. which merely trade coastlines | **done** |
| 02 | [`02_LIFE_THROUGH_DEEP_TIME.md`](02_LIFE_THROUGH_DEEP_TIME.md) | Paleobiology: the biology run forward era by era along the paleoclimate record, showing how the one tree became the four realms | **done** |
| 03 | [`03_HUMANOID_ANCESTRY.md`](03_HUMANOID_ANCESTRY.md) | The Meridian Aulacines: which Zoan lineage, in which basin, becomes the peoples of Phase 5 — and the dispersal asymmetry that follows | **done** |
| 04 | [`04_MERIDIAN_ARID_INTERIOR.md`](04_MERIDIAN_ARID_INTERIOR.md) | The first regional ecology: **M3**, the peoples' homeland — the three-lake basin system, the xeric flora, the ectotherm-dominated fauna, and the two domestication lines | **done** |
| 05 | [`05_SELVANAN_INTERIOR_DRY_BASIN.md`](05_SELVANAN_INTERIOR_DRY_BASIN.md) | **V3**, M3's homologous mirror: climate twins at mirror-image latitudes from one xeric stem, diverging on relief, seasonality, uniformity and water — and the control showing the cradle needed geology, not climate | **done** |
| 06 | [`06_SIROCCAN_ARID_HEART.md`](06_SIROCCAN_ARID_HEART.md) | **S2**, the convergent stranger — and on six structural axes M3's nearest twin, closer than its actual cousin. Three great lakes, deepest 14 m: a speciation pump with no refuge. No endotherms at all | **done** |
| 07 | [`07_BOREAN_SOUTHERN_MARITIME_COAST.md`](07_BOREAN_SOUTHERN_MARITIME_COAST.md) | **B1**, the hardest ecological line on the planet — and no wall on it. A thermal threshold compounded by a seasonality inversion, sealing the refuge that holds 98.7 % of Borea's frost-free land on 15.6 % of its area | **done** |
| 08 | [`08_CHRONOLOGY.md`](08_CHRONOLOGY.md) | **When.** The cradle dated from its own tephra, lake stratigraphy and salinity ratchet — then the history that follows: the Failure (~800 kyr) that stops the pump and fuses its isolates into the crown species, the Surge (~200 kyr) that expels them, and the crossings at ~90 / ~30 / ~10 kyr | **done** |
| 09 | [`09_THE_MERIDIAN_INTERVAL.md`](09_THE_MERIDIAN_INTERVAL.md) | **Where, and what they did there.** The 710 kyr — 89 % of the species' existence — between the Failure and the Selvanan crossing: 600 kyr on 2.24 Mkm², then the road out. Finds the throat at 27.5 °N (75 km in hops, not 213), a 1.31 km pass where a 7.66 km wall was assumed, and that the founders come from the continent's margin, not its core | **done** |
| 10+ | *Regional ecologies* | The rest of the wet and cold provinces. Next: **V1a**, the richest province on the planet and the far side of doc 09's crossing; then **B2**, which doc 07 runs up a debt to, or **M4**, the peoples' own neighbour | planned |

**Docs 08 and 09 are not regional ecologies** and do not belong to that
sequence. **08** answers the question docs 00–07 all defer — *when* — by showing
that the cradle keeps a finer record than the planet does, and it isolates its
invention into a single stated parameter (the **basin cycle**, proposed at
100 kyr) so the whole chronology can be rescaled or rejected as one piece. It
moved one figure in doc 03 §4: the crown species now begins at ~800 kyr rather
than T-8 Myr. **09** then occupies the largest interval that chronology creates
— the 710 kyr on Meridia — and measures the road out with
[`tools/crossings/`](../../tools/crossings/main.mjs); it annotated doc 01 §5,
whose "Equatorial Western Sea" turns out to name the rift's old latitude rather
than the present water's narrow point.

Regional ecologies are written **one province at a time**, on the province
partition of `../culture/00_PROVINCE_CONSTRAINT_VECTORS.md` §2 rather than on
the icosahedral gazetteer faces — provinces are the biogeographic unit (doc 01
draws every edge on an isolating barrier), and they are the interface the
culture layer consumes. Each is profiled from the raw export first by
`tools/province-ecology/`, so the invention starts from measured composition.

## Grounding rules

Everything here follows the Phase-5 label convention: **MEASURED** (from the
dataset) / **INTERPRETED** (a reading of the physical record) / **INVENTED**
(a creative choice consistent with, but not forced by, the data). Coined
biological names are provisional working labels, like the continent names.

Biology is **INVENTED by definition** — the generator models rock, water, and
climate, not life. The discipline of this layer is that every invention is
motivated by a physical fact and never contradicts one.
