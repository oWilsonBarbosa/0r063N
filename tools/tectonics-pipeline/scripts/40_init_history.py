"""Write a history/history.yaml skeleton from the inventory (refuses to overwrite).

The skeleton carries the blocks with their present centroids, identity keyframes,
empty stages, and the auto-extracted provenance feature list to be explained.
"""

import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import data_io
from lib.history_schema import STAGE_TIMES

out = data_io.HISTORY_DIR / "history.yaml"
if out.exists():
    print(f"{out} already exists; not overwriting")
    sys.exit(0)

inv = data_io.load_inventory()
blocks = {}
for letter, c in inv["cratons"].items():
    blocks[letter] = {"type": "craton", "present_centroid": c["centroid"],
                      "keyframes": [{"t": STAGE_TIMES[0], "c": c["centroid"], "spin": 0},
                                    {"t": 0, "c": c["centroid"], "spin": 0}]}
for name, m in inv["microcontinents"].items():
    blocks[f"micro_{name}"] = {"type": "microcontinent", "present_centroid": m["centroid"],
                               "keyframes": [{"t": STAGE_TIMES[0], "c": m["centroid"], "spin": 0},
                                             {"t": 0, "c": m["centroid"], "spin": 0}]}

provenance = []
for i, o in enumerate(inv["features"]["orogens"]):
    provenance.append({"feature": f"O{i + 1} orogen at {o['centroid']} (blocks {o['blocks']})",
                       "explained_by": "TODO"})
for i, t in enumerate(inv["features"]["trenches"]):
    provenance.append({"feature": f"T{i + 1} trench at {t['centroid']}", "explained_by": "TODO"})
for i, b in enumerate(inv["features"]["backarcs"]):
    provenance.append({"feature": f"B{i + 1} back-arc at {b['centroid']}", "explained_by": "TODO"})
for i, h in enumerate(inv["features"]["hotspots"]):
    provenance.append({"feature": f"H{i + 1} hotspot at {h['centroid']}", "explained_by": "TODO"})

doc = {
    "meta": {"cycle_style": "TODO extroversion|introversion|mixed",
             "supercontinent": "S1 (ABCDEFGHIJ)", "t_present": 0},
    "blocks": blocks,
    "oceans": [],
    "stages": [{"t": t, "events": [], "narrative": ""} for t in STAGE_TIMES],
    "provenance": provenance,
}
data_io.HISTORY_DIR.mkdir(parents=True, exist_ok=True)
with open(out, "w") as f:
    yaml.safe_dump(doc, f, sort_keys=False, allow_unicode=True)
print(f"wrote skeleton {out}")
