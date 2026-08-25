#!/usr/bin/env python3
"""Typological envelope for a biogeographic province.

Answers: among Earth languages spoken under a province's climate, what do
their grammars actually do?

The chain is

    province envelope  (tools/province-vectors, docs/culture/00_*)
      -> D-PLACE societies matched on that envelope
      -> their Glottocodes
      -> WALS / Grambank feature values

Output is a per-feature comparison of the matched set against the global
baseline, ranked by divergence: the point is not which values are common
(that is mostly a fact about the world sample) but which are *characteristic*
of this climate.

Same grounding discipline as the rest of the culture layer: every number here
is MEASURED from the published datasets. Nothing is invented, and the tool
deliberately stops before saying what a Meridian language should look like.

Usage
    python3 main.py M3
    python3 main.py B2 --source grambank --top 25
    python3 main.py --list

Zero dependencies (stdlib only), consistent with tools/province-vectors/.
"""

import argparse
import csv
import json
import math
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

csv.field_size_limit(1 << 30)

ROOT = Path(__file__).resolve().parents[2]          # the 0r063N repo
SIBLINGS = ROOT.parent                               # where the CLDF repos live
CACHE = Path(__file__).resolve().parent / ".cache"

DPLACE = SIBLINGS / "dplace-cldf" / "cldf"
WALS = SIBLINGS / "wals" / "cldf"
GRAMBANK = SIBLINGS / "grambank" / "cldf"

# D-PLACE's ecoclimate variables. The culture doc calls these Bio1/Bio12/NPP
# after WorldClim; the CLDF release does not use those names.
V_TEMP = "AnnualMeanTemperature"                 # °C, directly comparable
V_PRECIP = "MonthlyMeanPrecipitation"            # ml/m²/month -> x12/1000 = mm/yr
V_NPP = "MonthlyMeanNetPrimaryProduction"        # gC/m²/month, ordinal use only
V_ELEV = "Elevation"                             # m

# Earth terrestrial NPP spans roughly 0..1500 g/m²/yr. The province figures are
# calibrated onto that scale, so a province's NPP can be placed as a fraction of
# it -- but D-PLACE's NPP is in gC (a different absolute scale), so it is only
# ever compared by rank. See NOTES.md.
EARTH_NPP_CEILING = 1500.0


def load_provinces():
    """Province envelopes, via tools/province-vectors (cached: it decompresses 400 MB)."""
    CACHE.mkdir(exist_ok=True)
    cached = CACHE / "provinces.json"
    if not cached.exists():
        script = ROOT / "tools" / "province-vectors" / "main.mjs"
        out = subprocess.run(
            ["node", str(script), "--json"],
            capture_output=True, text=True, cwd=ROOT, check=True,
        ).stdout
        cached.write_text(out[out.index("["):])
    data = json.loads(cached.read_text())
    return {p["province"].split()[0]: p for p in data}


def load_dplace():
    """Societies with a Glottocode and a full ecoclimate vector."""
    socs = {}
    with open(DPLACE / "societies.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            gc = (row.get("Glottocode") or "").strip()
            if gc:
                socs[row["ID"]] = {"glottocode": gc, "name": row["Name"]}

    wanted = {V_TEMP, V_PRECIP, V_NPP, V_ELEV}
    env = defaultdict(dict)
    with open(DPLACE / "data.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Var_ID"] in wanted and row["Soc_ID"] in socs:
                try:
                    env[row["Soc_ID"]][row["Var_ID"]] = float(row["Value"])
                except ValueError:
                    pass

    out = []
    for sid, vals in env.items():
        if wanted <= set(vals):
            s = dict(socs[sid], id=sid)
            s["temp"] = vals[V_TEMP]
            s["precip_mm"] = vals[V_PRECIP] * 12 / 1000.0
            s["npp_raw"] = vals[V_NPP]
            s["elev"] = vals[V_ELEV]
            out.append(s)
    return out


def percentile_ranks(values):
    """Map each value to its percentile position (0..100) within the sample."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    for pos, i in enumerate(order):
        ranks[i] = 100.0 * pos / max(1, len(values) - 1)
    return ranks


def match_societies(prov, socs, temp_tol, npp_tol, use_precip, precip_tol):
    """Select societies whose environment sits inside the province envelope.

    Temperature and elevation are hard filters: both are in unambiguous units on
    both sides. NPP is matched by rank only. Precipitation is off by default --
    doc section 2.2 marks the simulated values unreliable by 2-4x in most provinces.
    """
    npp_ranks = percentile_ranks([s["npp_raw"] for s in socs])
    for s, r in zip(socs, npp_ranks):
        s["npp_pct"] = r

    target_npp_pct = 100.0 * min(prov["npp"], EARTH_NPP_CEILING) / EARTH_NPP_CEILING
    high = prov["pctOver2km"] >= 50

    hits = []
    for s in socs:
        if abs(s["temp"] - prov["tAnnC"]) > temp_tol:
            continue
        if high and s["elev"] < 1500:
            continue
        if not high and s["elev"] > 2500:
            continue
        if abs(s["npp_pct"] - target_npp_pct) > npp_tol:
            continue
        if use_precip and abs(s["precip_mm"] - prov["precipMm"]) > precip_tol:
            continue
        hits.append(s)
    return hits, target_npp_pct


def load_features(source):
    """(feature_id -> label, glottocode -> {feature_id: value}, glottocode -> (family, macroarea))."""
    base = WALS if source == "wals" else GRAMBANK

    labels = {}
    with open(base / "parameters.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            labels[row["ID"]] = row["Name"]

    codes = {}
    with open(base / "codes.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            # WALS puts the readable label in Name; Grambank's Name is the bare
            # 0/1 and the label lives in Description.
            name = (row.get("Name") or "").strip()
            desc = (row.get("Description") or "").strip()
            codes[row["ID"]] = desc if (desc and name in ("0", "1")) else (name or desc)

    lang2gc, meta = {}, {}
    with open(base / "languages.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            gc = (row.get("Glottocode") or "").strip()
            if gc:
                lang2gc[row["ID"]] = gc
                # WALS calls it Family, Grambank Family_name. Isolates and any
                # unclassified language fall back to their own Glottocode, which
                # correctly makes each its own stratum.
                fam = (row.get("Family") or row.get("Family_name") or "").strip()
                meta[gc] = (fam or gc, row.get("Macroarea") or "?")

    values = defaultdict(dict)
    with open(base / "values.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            gc = lang2gc.get(row["Language_ID"])
            if not gc:
                continue
            label = codes.get(row.get("Code_ID") or "", row.get("Value") or "")
            if label not in ("", "?"):
                values[gc][row["Parameter_ID"]] = label
    return labels, values, meta


def distributions(glottocodes, values, meta, stratify):
    """feature -> {value_label: weight}.

    Without stratification each language is one vote, so a single large family
    in the matched set decides the answer -- for M3 that is Niger-Congo at 38 %,
    and the result is an areal profile wearing a climate label. With
    stratification each *family* carries one vote, split across its members.
    """
    dist = defaultdict(lambda: defaultdict(float))
    counts = defaultdict(lambda: defaultdict(int))
    if stratify:
        per_family = defaultdict(list)
        for gc in glottocodes:
            per_family[meta.get(gc, (gc, "?"))[0]].append(gc)
        weights = {gc: 1.0 / len(members)
                   for members in per_family.values() for gc in members}
    else:
        weights = {gc: 1.0 for gc in glottocodes}

    for gc in glottocodes:
        for feat, val in values.get(gc, {}).items():
            dist[feat][val] += weights[gc]
            counts[feat][val] += 1
    return dist, counts


def concentration(glottocodes, meta):
    """How genealogically and areally lopsided is this matched set?"""
    fams = defaultdict(int)
    areas = defaultdict(int)
    for gc in glottocodes:
        fam, area = meta.get(gc, ("?", "?"))
        fams[fam] += 1
        areas[area] += 1
    n = max(1, len(glottocodes))
    top_fam = max(fams.items(), key=lambda kv: kv[1]) if fams else ("-", 0)
    top_area = max(areas.items(), key=lambda kv: kv[1]) if areas else ("-", 0)
    return {
        "n_families": len(fams),
        "top_family": top_fam[0],
        "top_family_pct": round(100.0 * top_fam[1] / n, 1),
        "top_macroarea": top_area[0],
        "top_macroarea_pct": round(100.0 * top_area[1] / n, 1),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("province", nargs="?", help="province code, e.g. M3, B2, V1a")
    ap.add_argument("--source", choices=["wals", "grambank"], default="wals")
    ap.add_argument("--top", type=int, default=15, help="features to report")
    ap.add_argument("--temp-tol", type=float, default=3.5, help="°C tolerance")
    ap.add_argument("--npp-tol", type=float, default=20.0, help="NPP percentile tolerance")
    ap.add_argument("--use-precip", action="store_true",
                    help="also filter on precipitation (see doc section 2.2 -- unreliable)")
    ap.add_argument("--precip-tol", type=float, default=400.0, help="mm/yr tolerance")
    ap.add_argument("--min-languages", type=int, default=8,
                    help="skip features attested in fewer matched languages")
    ap.add_argument("--min-families", type=float, default=4.0,
                    help="skip features spanning fewer independent families")
    ap.add_argument("--no-stratify", action="store_true",
                    help="one vote per language instead of per family (areally biased)")
    ap.add_argument("--list", action="store_true", help="list provinces and exit")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    provinces = load_provinces()

    if args.list or not args.province:
        print("province  T_ann   NPP   >2km  name")
        for code, p in sorted(provinces.items()):
            print(f"  {code:<6} {p['tAnnC']:6.1f} {p['npp']:6.0f} {p['pctOver2km']:5.0f}%  "
                  f"{' '.join(p['province'].split()[1:])}")
        return 0

    code = args.province
    if code not in provinces:
        print(f"unknown province {code!r}; try --list", file=sys.stderr)
        return 2
    prov = provinces[code]

    socs = load_dplace()
    hits, target_npp = match_societies(
        prov, socs, args.temp_tol, args.npp_tol, args.use_precip, args.precip_tol)
    matched_gc = {s["glottocode"] for s in hits}

    labels, values, meta = load_features(args.source)
    all_gc = set(values)
    covered = matched_gc & all_gc
    conc = concentration(covered, meta)

    stratify = not args.no_stratify
    matched_dist, matched_counts = distributions(covered, values, meta, stratify)
    global_dist, _ = distributions(all_gc, values, meta, stratify)

    rows = []
    for feat, weighted in matched_dist.items():
        raw = matched_counts[feat]
        n = sum(raw.values())                       # languages attesting the feature
        eff = sum(weighted.values())                # independent families, if stratified
        if n < args.min_languages or eff < args.min_families:
            continue
        gweighted = global_dist[feat]
        gn = sum(gweighted.values())
        val, w = max(weighted.items(), key=lambda kv: kv[1])
        local = 100.0 * w / eff
        base = 100.0 * gweighted.get(val, 0) / gn if gn else 0.0
        # A gap measured over 4 families is weaker evidence than the same gap
        # over 30, so rank by the gap scaled by sqrt(independent families).
        rows.append({
            "feature_id": feat,
            "feature": labels.get(feat, feat),
            "value": val,
            "n_matched": n,
            "n_families": round(eff, 1),
            "local_pct": round(local, 1),
            "global_pct": round(base, 1),
            "delta": round(local - base, 1),
            "weight": round((local - base) * math.sqrt(eff), 1),
        })
    rows.sort(key=lambda r: -abs(r["weight"]))
    rows = rows[:args.top]

    if args.json:
        print(json.dumps({
            "province": prov["province"],
            "envelope": {"t_ann_c": prov["tAnnC"], "npp": prov["npp"],
                         "precip_mm": prov["precipMm"], "pct_over_2km": prov["pctOver2km"]},
            "matched_societies": len(hits),
            "matched_languages": len(matched_gc),
            "with_features": len(covered),
            "stratified": stratify,
            "concentration": conc,
            "source": args.source,
            "features": rows,
        }, indent=2))
        return 0

    print(f"\n{prov['province']}")
    print(f"  envelope   T {prov['tAnnC']:.1f} °C · NPP {prov['npp']:.0f} g/m²/yr "
          f"(p{target_npp:.0f}) · {prov['pctOver2km']:.0f} % over 2 km"
          + (f" · precip {prov['precipMm']:.0f} mm" if args.use_precip else ""))
    print(f"  matched    {len(hits)} societies → {len(matched_gc)} languages "
          f"→ {len(covered)} with {args.source} data")
    if not covered:
        print("\n  nothing matched; widen --temp-tol or --npp-tol")
        return 1

    print(f"  sample     {conc['n_families']} families · "
          f"largest {conc['top_family']} {conc['top_family_pct']:.0f} % · "
          f"{conc['top_macroarea']} {conc['top_macroarea_pct']:.0f} %"
          + ("  [one vote per family]" if stratify else "  [UNSTRATIFIED]"))

    # The matched set is "languages spoken in this climate on Earth", and Earth
    # puts each climate mostly in one or two places. Say so when it is extreme.
    if conc["top_family_pct"] >= 30 or conc["top_macroarea_pct"] >= 60:
        print(f"  ⚠ areally lopsided — read the table as a menu of attested options,")
        print(f"    not as climate causation. {conc['top_macroarea']} dominates the sample.")
    if len(covered) < 20:
        print(f"  ⚠ thin sample ({len(covered)} languages) — treat as suggestive only.")

    if not rows:
        print(f"\n  No feature clears the thresholds (≥{args.min_languages} languages,")
        print(f"  ≥{args.min_families:.0f} independent families). Earth has very few")
        print("  ethnographic datapoints in this envelope — expected for the cold and")
        print("  high provinces (M1, B3, V2). Work from the eHRAF traditions listed in")
        print("  docs/culture/00_PROVINCE_CONSTRAINT_VECTORS.md instead; see NOTES.md.")
        return 1

    print(f"\n  {'feature':<50} {'characteristic value':<26} {'lg':>4} {'fam':>5} {'here':>6} {'world':>6} {'Δ':>6}")
    print("  " + "-" * 108)
    for r in rows:
        print(f"  {r['feature'][:49]:<50} {r['value'][:25]:<26} {r['n_matched']:>4} "
              f"{r['n_families']:>5.1f} {r['local_pct']:>5.0f}% {r['global_pct']:>5.0f}% "
              f"{r['delta']:>+5.0f}")
    print()
    print("  lg = languages attesting · fam = independent families (fractional votes)")
    print("  Δ  = points above/below the world sample, both family-weighted. Rank = Δ×√fam.")
    print("  MEASURED throughout — no invention. Earth analogues transfer as")
    print("  structure, never as content (docs/culture/README.md).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
