# The culture layer

Phase-5 groundwork for planet `06cy8w6z6a89kow6psje93` — the peoples, societies,
and traditions that the physical and life layers make possible.

The layer is built the same way as [`../life/`](../life/README.md): **constraints
first**. Before any culture is invented, the physical canon is converted into the
envelope it imposes, expressed in the variables that cross-cultural databases
index on — so that invention starts from the full range of real solutions to a
problem rather than from one remembered example.

| # | Document | Scope | Status |
|---|---|---|---|
| 00 | [`00_PROVINCE_CONSTRAINT_VECTORS.md`](00_PROVINCE_CONSTRAINT_VECTORS.md) | Per-province climate, productivity, and water-regime envelope, with ready-made eHRAF and D-PLACE queries and the invariants each envelope forces | **done** |
| 01+ | *Peoples and traditions* | Concrete societies for specific provinces | planned |

## Sequencing

The culture layer sat downstream of two documents that did not exist yet. One
now does: [`../life/03_HUMANOID_ANCESTRY.md`](../life/03_HUMANOID_ANCESTRY.md)
fixes the peoples as a single species out of Meridia's AU1 trough, and its §8
answers this layer's brief directly. The regional ecologies have begun:
[`../life/04_MERIDIAN_ARID_INTERIOR.md`](../life/04_MERIDIAN_ARID_INTERIOR.md)
covers **M3** and names the two domestication lines this layer was waiting on —
**Flushgrass** (the cereal-analogue's wild ancestor) and the **Rainherd** (the
pack-and-milk animal's).
[`../life/05_SELVANAN_INTERIOR_DRY_BASIN.md`](../life/05_SELVANAN_INTERIOR_DRY_BASIN.md)
adds **V3**, where those two lines have usable congeners — so a Meridian
agricultural toolkit crosses the Equatorial Western Sea intact, but its
**planting calendar does not**: V3 plants time on cooling as well as wetting,
a cue the Meridian homeland (2.4 °C annual range) never taught.
[`../life/06_SIROCCAN_ARID_HEART.md`](../life/06_SIROCCAN_ARID_HEART.md) closes
the desert set with **S2**, where the toolkit fails instead: same climate, same
landscape, no shared lineage, and **no endotherms at all** — the Thermozoa are a
west-flank invention, so Sirocca and Borea are copper-blue worlds.
[`../life/07_BOREAN_SOUTHERN_MARITIME_COAST.md`](../life/07_BOREAN_SOUTHERN_MARITIME_COAST.md)
opens the cold set with **B1**, and hands this layer a **second, independent
cereal cradle** — a winter-wet Mediterranean two-thirds that manufactures
storable winter annuals — together with the constraint that no animal can be
paired with it anywhere on the continent. It also corrected four figures in
doc 00's own B1 block (see §4 there). The remaining provinces
(`../life/11+`) are still outstanding.

[`../life/08_CHRONOLOGY.md`](../life/08_CHRONOLOGY.md) then supplies the axis
this layer has been working without: **when**. Four of its results bear directly
on culture. Dispersal begins as an **expulsion** (~200 kyr, when the cradle's
salt sea becomes unusable) rather than an achievement, so no founding myth of a
chosen departure is correct. The founding population is a **fusion, not a
bottleneck** — the most diverse the planet has ever held — so "a handful of
survivors" is backwards, and regional variation among the peoples is ancestral
variation being re-sorted rather than drift after dispersal. **Regional
difference is older than continental difference**: two Meridian peoples can be
more distantly related to each other than either is to anyone in Borea. And
Borea is settled at **~10 kyr**, on top of the agricultural window — so B1's
independent cereal cradle is roughly contemporaneous with arrival rather than
long predating it.

[`../life/09_THE_MERIDIAN_INTERVAL.md`](../life/09_THE_MERIDIAN_INTERVAL.md)
then occupies the 710 kyr before the first crossing, and hands this layer four
things. **Mobility is the baseline and sedentism the innovation** — the founding
habit is a long vertical annual circuit between two waters 1,362 km and 1,843 m
apart, because only a lineage working both survived the Failure. **The
domestication relationship predates the dispersal by 600 kyr**: Flushgrass and
the Rainherds are lived with for 6,000 cycles before anything is domesticated,
so domestication formalises an acquaintance rather than making a discovery.
**The exit technology is repeatable short-water craft, not seafaring** — the
Selvanan crossing is 75 km as its longest leg once the strait's islands are
counted; save blue-water capability for the Eastern Ocean at ~30 kyr. And the
structural one: **the founders are not from the core.** Meridia's population
settles east into M4's lowlands (NPP 537 → 1,353), while the thread that reaches
Selvana runs 5,225 km west to a shore that is 62 % true desert. Every other
continent is peopled from a marginal fringe of the continent that stayed.

[`../life/10_SELVANAN_TROPICAL_NORTH.md`](../life/10_SELVANAN_TROPICAL_NORTH.md)
profiles **V1a**, this layer's own top-ranked province, and complicates the
ranking. **The wet core cannot make a cereal**: a seed crop is manufactured by a
dry season, and the `Af` core has none, so its staple (**Vine-tuber**) is
vegetative and **not storable**. That removes the usual route from surplus to
hierarchy — a tuber left in the ground is a bank that cannot be taxed, raided or
requisitioned in one visit — while leaving food security trivial at NPP 1,596
with no hungry month. Grain, herds (**Bandherds**) and storage live instead in
the **savanna band**, so V1a is two economies split by latitude, and the richest
ground on the planet should hold its *least* politically concentrated societies.
It also corrected the arrival: the peoples land in V1a's **arid northern tip**,
0 % rainforest and NPP 846, drier than the cradle they left — 680 km short of
the rainforest and 4,715 km short of doc 05's V3 congeners. Doc 00 §2's warning
that **V1b is an operational zone** is now shown to cost more than a blurred
vector: it makes the V1a/V1b ecotone meaningless, and Selvana's subtropical belt
needs a real boundary before anything is designed against it.

## The partition correction, adopted

Doc 05 §7 found a **defect in this layer's own partition**: the longitude-based
continent proxy that doc 00 §2 used dropped 1.80 Mkm² of land planet-wide
(1.69 % of all land) and undercounted Selvana by 1.39 Mkm² (−5.1 %) against
`reports/tectonics/inventory.json`, while inflating the other three continents.

**It has been replaced and the master table regenerated.**
[`../../tools/continents.mjs`](../../tools/continents.mjs) ports the
connected-landmass assignment the tectonics pipeline already used
(`tools/tectonics-pipeline/lib/continents.py`, also behind
[`../BIOGEOGRAPHY.md`](../BIOGEOGRAPHY.md)) into zero-dependency Node, and
reproduces the authoritative continent areas to within 0.27 Mkm². The whole
repository now partitions the planet one way.

```sh
node tools/province-vectors/main.mjs                      # -> doc 00 table
node tools/province-vectors/main.mjs --continents proxy   # the superseded table
node tools/province-vectors/validate-continents.mjs       # the full delta
```

What moved, and what it meant:

| Province | Delta | Consequence |
|---|---:|---|
| **B1** Southern Maritime Coast | **−21 %** | the largest change on the planet; B1 drops from 10th to 11th by NPP × area |
| **V4** Southern Cordillera | +15.2 % | rises two places, past S2 and M2 |
| **M4** S. Tropical Lowlands | −9.6 % | keeps 3rd |
| S3 · S1 · V1b | −7.3 % · −5 % · +6.8 % | V1b pulls further clear in 5th |
| everything else | ≤ 2.3 % | including M3 and V3, the two provinces the life layer has documented |

**§5's "four provinces that will carry the world" survives** — V1a, S1, M4, V1b,
in that order, with V1b strengthened. The table also gains an **Islands**
accounting row (4.03 Mkm²), which the proxy had no bucket for; it is there so no
land goes missing, and it is explicitly not a design envelope.

No climate figure in the table moved by more than a rounding unit, so every
downstream reading of temperature, precipitation, NPP or Köppen composition is
unaffected.

## Grounding rules

Same Phase-5 convention as the life layer: **MEASURED** (from the dataset) /
**INTERPRETED** (a reading of the physical record) / **INVENTED** (a creative
choice consistent with, but not forced by, the data).

Doc 00 contains no invention at all — it is MEASURED values and stated
derivations from them. Everything downstream of it will be INVENTED, and the
discipline is the same as the life layer's: every invention is motivated by a
physical fact and never contradicts one.

One additional rule specific to this layer: **Earth analogues transfer as
structure, never as content.** The cross-cultural databases silently assume
wheat, rice, cattle, and horses, none of which exist here. What survives
translation is the specification — what an economy *requires* — and the biology
layer has to supply something that meets it.

## Regenerating

```sh
node tools/province-vectors/main.mjs           # markdown table
node tools/province-vectors/main.mjs --json    # machine-readable
```

The precipitation columns convert the normalized index through
`tools/precip-scale.mjs` (813.7 mm per unit index per half-year), shared with
the regional-report pipeline so the reports, atlas, derived hydrology and these
vectors all describe one planet.

That constant is fitted to the generator snapshot **that produced this export**
(`f9bb081`, pinned in `orogen_meta_full_v2.json`), not to the current
generator. The distinction matters: `js/elevation.js` has been largely
rewritten since, and `js/climate-config.js` did not exist at the time, so the
present-day climate constants are not transferable backwards. To re-derive it —
needs a generator checkout plus `npm i delaunator@5.0.1 pngjs`:

```sh
git worktree add /tmp/gen-f9bb081 f9bb081        # in a generator checkout
GENERATOR_ROOT=/tmp/gen-f9bb081 \
  node tools/province-vectors/earth-calibration-snapshot.mjs 160000
```

It runs that snapshot's own climate chain on `assets/earth.png` and reports the
implied global land mean, the zonal profile, and the per-Köppen-class
breakdown that section 2.2 of doc 00 turns into reliability bands.

`earth-calibration.mjs` is the same experiment against the *current* generator.
Keep it for comparison, but do not calibrate this dataset with its output.

## Caveat: millimetres vs. the stored Köppen labels

`f9bb081` classified Köppen using a hardcoded 1000 mm per unit index — a
placeholder, which is why the later climate-tuning commit replaced it with a
fitted parameter. Against real Earth that 1000 runs ~23 % high, so the
millimetres reported here (fitted: 813.7) will not exactly reproduce the
Köppen boundaries stored beside them.

That trade is deliberate. Everything these millimetres feed — terrain classes,
humidity bands, D-PLACE `Bio12` filters — is stated in real millimetres and
compared against real-world data, so physical accuracy is worth more than
agreement with a placeholder. Where a decision turns on the class boundary
rather than the amount, trust the stored `koppen` column.
