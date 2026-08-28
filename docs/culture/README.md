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
a cue the Meridian homeland (2.4 °C annual range) never taught. The remaining
provinces (`../life/06+`) are still outstanding.

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
