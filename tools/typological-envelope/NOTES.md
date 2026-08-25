# Typological envelope — method and limits

What the tool does: take a province's measured climate envelope, find the Earth
societies living inside it, follow their Glottocodes into WALS and Grambank, and
report which grammatical features are over- or under-represented there relative
to the world sample.

It is the language counterpart of the D-PLACE/eHRAF step in
[`docs/culture/00_PROVINCE_CONSTRAINT_VECTORS.md`](../../docs/culture/00_PROVINCE_CONSTRAINT_VECTORS.md),
and it inherits that document's discipline: everything reported is MEASURED, and
Earth analogues transfer as **structure, never as content**.

## The join

```
tools/province-vectors  ──►  province envelope (T, NPP, elevation)
                                    │
                    dplace-cldf/cldf/data.csv  (ecoclimate variables)
                                    │
                    dplace-cldf/cldf/societies.csv  ──►  Glottocode
                                    │
                    wals | grambank  languages.csv ──► values.csv
```

Coverage, measured on the current checkouts:

| Step | Count |
|---|---:|
| D-PLACE societies | 6,684 |
| …with a Glottocode | 6,585 (2,837 distinct) |
| …with a full ecoclimate vector | 1,987 (1,322 distinct Glottocodes) |
| …also in WALS | 758 |
| …also in Grambank | 661 |
| …in WALS **or** Grambank | 893 |
| …in WALS **and** Grambank | 526 |

The ecoclimate variables are not confined to one ethnographic sample — they
cover EA (1,291), Binford (339), SCCS (186) and WNAI (172), so the climate-coded
subset is not a hunter-gatherer-only artefact.

## Variable names

The culture doc names the filters `Bio1` / `Bio12` / `NPP`, which is how the
D-PLACE **web interface** presents them. The CLDF release uses different IDs and
units, so the tool maps:

| Doc / web UI | CLDF `Var_ID` | Unit | Handling |
|---|---|---|---|
| `Bio1` | `AnnualMeanTemperature` | °C | direct comparison |
| `Bio12` | `MonthlyMeanPrecipitation` | ml/m²/month | ×12÷1000 → mm/yr |
| `NPP` | `MonthlyMeanNetPrimaryProduction` | gC/m²/month | **rank only** |
| elevation | `Elevation` | m | direct comparison |

Precipitation converts cleanly on spot checks (Egyptians → 35 mm/yr, Semang →
2,892 mm/yr) but is only order-of-magnitude reliable elsewhere. NPP in gC/m²/month
does not reconcile with the province figures in g/m²/yr — roughly an order of
magnitude apart — so NPP is **never compared absolutely**, only by percentile
rank within D-PLACE's own distribution.

## Three limits that matter

**1. The matched set is areally lopsided, and that is not a bug in the tool — it
is a fact about Earth.** Each climate band on Earth sits mostly in one or two
places, so its languages are mostly one or two families. M3's envelope returns
70 % African, 38 % Niger-Congo. The unstratified output for M3 therefore
"discovered" SVO, prepositions and Noun-Genitive — the Niger-Congo profile with a
climate label on it.

Mitigation: **one vote per family**, split fractionally across its members
(`--no-stratify` disables this and is not recommended). Stratification changes
the M3 answer substantially — word-order features drop out of the top and
phonological and negation features rise. The tool also prints family and
macroarea concentration on every run and warns when either is extreme.

Even stratified, this is **not evidence of climate causation**. Read the output
as *a menu of options attested under these conditions*, which is exactly what the
culture doc asks of the D-PLACE step: the full range of real solutions, not one
remembered example.

**2. Cold, high provinces have almost no sample.** M1 (−6.7 °C, 100 % above 2 km)
matches 3 societies and 2 WALS languages. Earth simply has few high-cold
ethnographic datapoints. For M1, B3 and V2, treat the tool as unusable and work
from the qualitative eHRAF traditions the culture doc already lists.

**3. Precipitation filtering is off by default.** Doc §2.2 marks the simulated
precipitation overstated 2–4× in most provinces. `--use-precip` exists but will
mostly just shrink the sample against a number the doc itself distrusts.
Temperature and elevation carry the filter.

## Usage

```sh
python3 main.py --list                        # provinces and their envelopes
python3 main.py M3                            # WALS, stratified
python3 main.py B2 --source grambank --top 25
python3 main.py V1a --json                    # machine-readable
```

Expects the CLDF repos checked out beside this one (`../dplace-cldf`, `../wals`,
`../grambank`). The province envelopes are cached in `.cache/provinces.json`
because regenerating them decompresses the ~400 MB v2 export; delete the file to
refresh.

Stdlib only, consistent with `tools/province-vectors/`.
