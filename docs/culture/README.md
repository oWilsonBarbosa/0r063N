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

The culture layer sits downstream of two documents that do not exist yet — the
regional ecologies (`../life/03+`) and the humanoid-ancestry document. Rather
than wait, doc 00 is designed to be read **backwards**: the subsistence
requirements it extracts (a herdable cold-tolerant animal here, a storable
cereal-analogue there) are a design brief for those biology documents, not a
consumer of them.

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

The precipitation columns use the generator's Earth-fitted
`CLIMATE.KOPPEN_PRECIP_SCALE_MM` (838.5683 mm per unit index per half-year),
**not** the uncalibrated 1000 in `tools/regional-report/classify.mjs`. To
re-verify that constant against real Earth — this needs a full generator
checkout plus `npm i delaunator@5.0.1 pngjs`, since `third_party/` here is a
partial snapshot:

```sh
GENERATOR_ROOT=/path/to/planet_heightmap_generation \
  node tools/province-vectors/earth-calibration.mjs 160000
```

It runs the generator's own climate chain on `assets/earth.png` and reports
the implied global land mean, the zonal profile, and the per-Köppen-class
breakdown that section 2.2 of doc 00 turns into reliability bands.

## Known inconsistency

`tools/regional-report/classify.mjs` converts the same index with a hardcoded
1000, which overstates precipitation by ~19 %. That convention is baked into
the published regional gazetteers and the atlas, so it is left alone here
rather than silently changed — but the humidity classes in those reports
(`arid` < 250 mm, `semi-arid` < 500, `sub-humid` < 1000) sit on thresholds
that the calibration moves. Worth correcting on the next atlas regeneration.
