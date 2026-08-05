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
