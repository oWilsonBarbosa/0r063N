"""Schema and validation for history/paleoclimate.yaml (the climate forcing curve).

Structure:
  meta: {model, anchor_t0: {...}}
  eras: [{name, span: [t0, t1], narrative}]        # contiguous partition of [-750, 0]
  stages: [{t, dT_global, co2_ppm, ice_hint, drivers: [{event, effect, notes}],
            narrative}]                            # exactly STAGE_TIMES
"""

import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.history_schema import STAGE_TIMES

ICE_HINTS = {"none", "polar", "major_glaciation"}
EFFECTS = {"cool", "warm", "neutral"}


def load(path, history=None):
    with open(path) as f:
        pc = yaml.safe_load(f)
    errors = validate(pc, history)
    if errors:
        raise ValueError("paleoclimate.yaml invalid:\n  " + "\n  ".join(errors))
    return pc


def validate(pc, history=None):
    errors = []
    stages = pc.get("stages", [])
    ts = [s["t"] for s in stages]
    if ts != STAGE_TIMES:
        errors.append(f"stages must cover {STAGE_TIMES[0]}..0 every 50 Myr (got {ts})")
        return errors
    prev_dT = None
    for s in stages:
        dT = s.get("dT_global")
        if dT is None or not (-10.0 <= dT <= 8.0):
            errors.append(f"stage T{s['t']}: dT_global must be in [-10, 8] (got {dT})")
        if s["t"] == 0 and dT != 0.0:
            errors.append("stage T-0 must have dT_global == 0 (present-day anchor)")
        if s.get("ice_hint", "none") not in ICE_HINTS:
            errors.append(f"stage T{s['t']}: ice_hint must be one of {sorted(ICE_HINTS)}")
        if prev_dT is not None and dT is not None and abs(dT - prev_dT) > 1.5:
            if not s.get("drivers"):
                errors.append(f"stage T{s['t']}: |dT| change {abs(dT - prev_dT):.1f} > 1.5 C "
                              "requires at least one listed driver")
        for d in s.get("drivers", []):
            if d.get("effect") not in EFFECTS:
                errors.append(f"stage T{s['t']}: driver effect must be in {sorted(EFFECTS)}")
        prev_dT = dT
    eras = pc.get("eras", [])
    if not eras:
        errors.append("eras: at least one era required")
    else:
        if eras[0]["span"][0] != STAGE_TIMES[0] or eras[-1]["span"][1] != 0:
            errors.append(f"eras must span [{STAGE_TIMES[0]}, 0]")
        for e0, e1 in zip(eras[:-1], eras[1:]):
            if e0["span"][1] != e1["span"][0]:
                errors.append(f"era gap/overlap between '{e0['name']}' and '{e1['name']}'")
    # soft cross-check against history.yaml event vocabulary
    if history is not None:
        vocab = set()
        for st in history.get("stages", []):
            for e in st.get("events", []):
                vocab.add(e["type"])
        vocab |= {"assembled", "breakup", "supercontinent", "tenure", "dispersal"}
        pat = re.compile("|".join(re.escape(v) for v in vocab), re.IGNORECASE)
        for s in stages:
            for d in s.get("drivers", []):
                if not pat.search(d.get("event", "")):
                    errors.append(f"stage T{s['t']}: driver '{d.get('event')}' references "
                                  "no known history event type")
    return errors


def era_of(pc, t):
    for e in pc["eras"]:
        if e["span"][0] <= t <= e["span"][1]:
            return e
    return None


def stage_forcing(pc, t):
    for s in pc["stages"]:
        if s["t"] == t:
            return s
    raise KeyError(t)
