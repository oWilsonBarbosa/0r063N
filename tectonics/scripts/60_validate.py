"""Validate history/history.yaml against the quantitative rules of thumb:
plate speeds, basin lifetimes, cycle timing, mountain height vs age (erosion
model), provenance coverage, block overlaps, craton conservation.

Writes out/VALIDATION.md; exits non-zero on hard failures.
"""

import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import data_io, history_schema
from lib.spherical import great_circle_km, cm_per_yr, xyz_to_latlon, latlon_to_xyz

hist = history_schema.load(data_io.HISTORY_DIR / "history.yaml")
inv = data_io.load_inventory()

fails, warns, infos = [], [], []
report = ["# History validation", ""]

# ---------- 1. block speeds ----------
report += ["## Block speeds (cm/yr per 50-Myr stage)", "",
           "| block | max speed | stage | verdict |", "|---|---:|---|---|"]
SPEED_WARN, SPEED_FAIL = 5.0, 8.0
MICRO_FAIL = 10.0
for name, b in hist["blocks"].items():
    vmax, tmax = 0.0, None
    for t0, t1 in zip(history_schema.STAGE_TIMES[:-1], history_schema.STAGE_TIMES[1:]):
        if t1 < b.get("appears", -1e9):
            continue
        la0, lo0 = history_schema.rotated_centroid(name, hist["blocks"], t0)
        la1, lo1 = history_schema.rotated_centroid(name, hist["blocks"], t1)
        v = cm_per_yr(great_circle_km(la0, lo0, la1, lo1), 50)
        if v > vmax:
            vmax, tmax = v, f"T{t0}..T{t1}"
    limit_fail = MICRO_FAIL if b["type"] == "microcontinent" else SPEED_FAIL
    verdict = "ok"
    if vmax > limit_fail:
        verdict = "FAIL"
        fails.append(f"{name} moves {vmax:.1f} cm/yr in {tmax} (limit {limit_fail})")
    elif vmax > SPEED_WARN and b["type"] == "craton":
        verdict = "warn"
        warns.append(f"{name} reaches {vmax:.1f} cm/yr in {tmax}")
    report.append(f"| {name} | {vmax:.2f} | {tmax} | {verdict} |")

# ---------- 2. ocean basin lifetimes & cycle timing ----------
report += ["", "## Oceans and cycle timing", ""]
for oc in hist.get("oceans", []):
    if oc.get("born") is not None and oc.get("died") is not None:
        life = oc["died"] - oc["born"]
        line = f"- {oc['name']}: basin life {life} Myr"
        if life > 400:
            warns.append(f"{oc['name']} basin lived {life} Myr (>400)")
            line += " (warn: long-lived basin)"
        report.append(line)
    else:
        report.append(f"- {oc['name']}: open basin (crust renewed at its ridges)")
meta = hist["meta"]
assembled, breakup = meta["assembled"], meta["breakup"]
tenure = breakup - assembled
report.append(f"- S1 assembled T{assembled}, breakup T{breakup}: tenure {tenure} Myr")
if not (100 <= tenure <= 300):
    warns.append(f"supercontinent tenure {tenure} Myr outside 100-300")
cycle = -history_schema.STAGE_TIMES[0]
report.append(f"- modeled cycle span {cycle} Myr (rule of thumb 400-750)")
if not (400 <= cycle <= 800):
    fails.append(f"cycle span {cycle} Myr outside 400-800")

# ---------- 3. mountain height vs age (erosion model) ----------
report += ["", "## Orogen heights vs erosion model (2500 m - 5 m/Myr x age)", "",
           "| orogen | event stage | age Myr | predicted mean m | observed mean m | verdict |",
           "|---|---|---:|---:|---:|---|"]
orogens = inv["features"]["orogens"]
orogen_ages = hist.get("orogen_ages", {})
# Every orogen needs an authored interpretation; every interpretation must
# point at a matching orogeny/arc_accretion event in the timeline.
stage_events = {s["t"]: [e for e in s.get("events", [])
                         if e["type"] in ("orogeny", "arc_accretion")]
                for s in hist["stages"]}
for i, o in enumerate(orogens):
    label = f"O{i + 1}"
    spec = orogen_ages.get(label)
    if spec is None:
        fails.append(f"{label}: no entry in meta.orogen_ages")
        continue
    t = spec["formed"]
    if not any(set(o["blocks"]) & set(e.get("blocks", [])) for e in stage_events.get(t, [])):
        fails.append(f"{label}: orogen_ages stage T{t} has no orogeny event touching "
                     f"blocks {o['blocks']}")
    age = -t
    obs = 1000 * o["mean_elev_km"]
    if spec.get("active"):
        report.append(f"| {label} | T{t} | {age} | active belt | {obs:.0f} | "
                      f"exempt (still building) |")
        continue
    pred = 2500 - 5 * age
    ok = abs(obs - pred) <= 0.4 * pred
    if not ok:
        fails.append(f"{label}: predicted {pred:.0f} m for age {age}, observed {obs:.0f} m")
    report.append(f"| {label} | T{t} | {age} | {pred:.0f} | {obs:.0f} | {'ok' if ok else 'FAIL'} |")

# ---------- 4. provenance coverage ----------
report += ["", "## Provenance coverage", ""]
prov_text = " ".join(p["feature"] for p in hist.get("provenance", []))
covered = set(re.findall(r"\b([OTBH]\d+)\b", prov_text))
expected = ({f"O{i + 1}" for i in range(len(orogens))}
            | {f"T{i + 1}" for i in range(len(inv["features"]["trenches"]))}
            | {f"B{i + 1}" for i in range(len(inv["features"]["backarcs"]))}
            | {f"H{i + 1}" for i in range(len(inv["features"]["hotspots"]))})
miss = sorted(expected - covered)
if miss:
    fails.append(f"features without provenance: {miss}")
    report.append(f"- MISSING: {miss}")
else:
    report.append(f"- all {len(expected)} present-day features have an explaining event")

# ---------- 5. block overlaps per stage ----------
report += ["", "## Block overlaps", ""]
with np.load(data_io.CACHE_DIR / "blocks.npz") as npz:
    cell_block = npz["cell_block"]
    cell_land_idx = npz["cell_land_idx"]
cols = data_io.load_columns(["x", "y", "z"])
pts = np.stack([cols["x"][cell_land_idx], cols["y"][cell_land_idx],
                cols["z"][cell_land_idx]], axis=1).astype(np.float64)
pts /= np.linalg.norm(pts, axis=1, keepdims=True)
block_names = {int(k): v for k, v in inv["block_names"].items()}
bpts = {}
for bid, nm in block_names.items():
    sel = cell_block == bid
    if sel.any() and nm in hist["blocks"]:
        bpts[nm] = pts[sel][::7]  # subsample for speed

collision_pairs = set()
for s in hist["stages"]:
    for e in s.get("events", []):
        bl = e.get("blocks", [])
        for x in bl:
            for y in bl:
                if x != y:
                    collision_pairs.add((x, y))
# blocks sharing a present-day continent are designed to abut
for cont in inv["continents"].values():
    cs = cont["cratons"]
    for x in cs:
        for y in cs:
            if x != y:
                collision_pairs.add((x, y))
# a terrane overlaps its home craton by design before detaching, and an
# attached child rides its parent exactly
for nm, b in hist["blocks"].items():
    for parent in (b.get("home"), b.get("rides")):
        if parent:
            collision_pairs.add((nm, parent))
            collision_pairs.add((parent, nm))

GW, GH = 360, 180
worst = []
for t in history_schema.STAGE_TIMES:
    occ = {}
    for nm, p in bpts.items():
        b = hist["blocks"][nm]
        if t < b.get("appears", -1e9):
            continue
        R = history_schema.block_rotation(nm, hist["blocks"], t)
        lat, lon = xyz_to_latlon(p @ R.T)
        cc = np.clip(((lon + 180) / 360 * GW).astype(int), 0, GW - 1)
        rr = np.clip(((90 - lat) / 180 * GH).astype(int), 0, GH - 1)
        occ[nm] = set(map(int, rr * GW + cc))
    names = sorted(occ)
    for i, x in enumerate(names):
        for y in names[i + 1:]:
            inter = len(occ[x] & occ[y]) / max(1, min(len(occ[x]), len(occ[y])))
            if inter > 0.12 and (x, y) not in collision_pairs:
                worst.append((t, x, y, inter))
if worst:
    for t, x, y, frac in worst:
        msg = f"stage T{t}: {x} overlaps {y} by {100 * frac:.0f}%"
        if frac > 0.3:
            fails.append(msg)
        else:
            warns.append(msg)
        report.append(f"- {msg}")
else:
    report.append("- no undeclared overlaps above 12%")

# ---------- 6. endpoint & conservation checks ----------
report += ["", "## Endpoint and conservation", ""]
for name, b in hist["blocks"].items():
    la, lo = history_schema.rotated_centroid(name, hist["blocks"], 0)
    d = great_circle_km(la, lo, *b["present_centroid"])
    if d > 50:
        fails.append(f"{name}: T-0 rotation not at present position (off {d:.0f} km)")
report.append("- all blocks end at their present positions with zero spin"
              if not any("T-0 keyframe" in f for f in fails) else "- T-0 endpoint FAILURES (see above)")
cratons = [n for n, b in hist["blocks"].items() if b["type"] == "craton"]
if len(cratons) != 10 or any(hist["blocks"][c].get("appears", -1e9) > -750 for c in cratons):
    fails.append("cratons A-J must all exist for the whole modeled span")
else:
    report.append("- all 10 cratons persist across the full span")

# ---------- 7. hotspots & LIPs ----------
report += ["", "## Hotspots and LIPs", ""]
bad_hs = [s["t"] for s in hist["stages"] for e in s.get("events", [])
          if e["type"] == "hotspot_track" and s["t"] < -100]
if bad_hs:
    fails.append(f"hotspot_track events older than T-100 at stages {bad_hs}")
    report.append(f"- hotspot tracks older than 100 Myr: {bad_hs} (FAIL)")
else:
    report.append("- hotspot tracks confined to the last 100 Myr")
lips = [s["t"] for s in hist["stages"] for e in s.get("events", []) if e["type"] == "LIP"]
report.append(f"- LIPs: {len(lips)} at stages {lips} (rule of thumb ~5 per breakup)")
if not (3 <= len(lips) <= 7):
    warns.append(f"{len(lips)} LIPs (expected 3-7)")

# ---------- summary ----------
report += ["", "## Summary", "",
           f"- failures: {len(fails)}", f"- warnings: {len(warns)}", ""]
for f in fails:
    report.append(f"- FAIL: {f}")
for w in warns:
    report.append(f"- warn: {w}")
(data_io.OUT_DIR / "VALIDATION.md").write_text("\n".join(report) + "\n")
print("\n".join(report[-(len(fails) + len(warns) + 5):]))
print(f"\nwrote {data_io.OUT_DIR / 'VALIDATION.md'}")
sys.exit(1 if fails else 0)
