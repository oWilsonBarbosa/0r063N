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

## A correction available to this layer

Doc 05 §7 records a **defect in this layer's own partition**: the
longitude-based continent proxy of §2 drops 1.80 Mkm² of land planet-wide and
undercounts Selvana by 1.39 Mkm² (−5.1 %) against
`reports/tectonics/inventory.json`, while inflating the other three continents.

**The fix now exists.** [`tools/continents.mjs`](../../tools/continents.mjs)
ports the connected-landmass assignment the tectonics pipeline already used
(`tools/tectonics-pipeline/lib/continents.py`, also behind `docs/BIOGEOGRAPHY.md`)
into zero-dependency Node, and reproduces the authoritative continent areas to
within 0.27 Mkm². Both Node tools accept `--continents connected`; the full
per-province delta is printed by:

```sh
node tools/province-vectors/validate-continents.mjs
```

**The published vectors in doc 00 still use the proxy**, so this document and
every figure downstream of it remain internally consistent. Adopting the
corrected rule is a decision for this layer, because it is not merely numeric:

| Province | Delta | Why it matters here |
|---|---:|---|
| **B1** Southern Maritime Coast | **−21 %** | the largest change on the planet; §5 rates B-group coasts a top state-formation bet |
| **V4** Southern Cordillera | +15.2 % | |
| **M4** S. Tropical Lowlands | −9.6 % | §5 ranks M4 second by NPP × area |
| **V1b** Subtropical Belt | +6.8 % | §5 ranks V1b fourth — the M4/V1b move may reorder that list |
| S3 · S1 | −7.3 % · −5 % | |
| M1 · V2 · S2 · B3 · V3 · M3 | ≤ 2.3 % | the provinces the life layer has documented barely move |

Two editorial questions come with the switch: whether §5's "four provinces that
will carry the world" ranking survives the M4/V1b move, and whether the master
table should gain **Islands** rows (the corrected rule assigns 4.03 Mkm² there,
matching `docs/BIOGEOGRAPHY.md`, where the proxy had no such bucket).

Doc 00 was designed to be read **backwards**, and that still holds: the
subsistence requirements it extracts (a herdable cold-tolerant animal here, a
storable cereal-analogue there) are a design brief for those biology
documents, not a consumer of them. Doc 03 §8 is the first reply to it.

Two results from doc 03 that this layer should now assume: the peoples
originate in **M3** (the southeastern trough) but domesticate in **M2/M3's
northwestern lakeland**, so the origin province and the agricultural province
are different places; and **Selvana's biota is deep kin to Meridia's** (same
west-flank branch, one narrow sea away) while **Sirocca's only looks
familiar** — a near-identical desert climate across the Eastern Ocean with no
shared ancestry at all. That sets what transplants, herds, and crops can
survive a crossing: almost everything westward, almost nothing eastward.

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
