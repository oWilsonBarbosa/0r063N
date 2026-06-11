"""Schema and kinematics for history/history.yaml.

A block (craton A-J or microcontinent) moves by keyframes:
  blocks:
    A:
      present_centroid: [lat, lon]
      appears: -750            # optional; block not rendered before this time
      keyframes:               # ascending t (Myr, negative = past); t=0 required
        - {t: -750, c: [lat, lon], spin: 25}
        - {t: 0,    c: [lat, lon], spin: 0}

Position at time t: spherical-linear interpolation of the centroid between the
bracketing keyframes plus linear interpolation of 'spin' (degrees, counter-
clockwise about the block centroid). The block's full rigid rotation is the
great-circle rotation carrying the present centroid to the paleo centroid,
composed with the spin about the paleo centroid.

Microcontinents may instead be ATTACHED to a parent block, inheriting its
rotation (which preserves their exact present-day geometry relative to it):
  rides: B                     # full-span attachment (accreted terrane), or
  rides: B
  detach: -200                 # attached for t <= -200, keyframed after
  keyframes: [{t: -200, ...}, ..., {t: 0, ...}]
  rides: G
  dock: -50                    # keyframed before, attached for t >= -50
  keyframes: [..., {t: -50, ...}]

Stages run T-750 .. T-0 every 50 Myr. Events live under stages[].events.
"""

import sys
from pathlib import Path

import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.spherical import latlon_to_xyz, rotation_matrix, xyz_to_latlon

STAGE_TIMES = list(range(-750, 1, 50))
EVENT_TYPES = {"rift", "failed_rift", "orogeny", "arc_accretion", "LIP",
               "subduction_init", "subduction_jump", "reversal", "ridge_birth",
               "ridge_death", "triple_junction", "hotspot_track", "note"}
OROGENY_CLASSES = {"andean", "laramide", "ural", "himalayan"}


def load(path):
    with open(path) as f:
        h = yaml.safe_load(f)
    errors = validate(h)
    if errors:
        raise ValueError("history.yaml invalid:\n  " + "\n  ".join(errors))
    return h


def validate(h):
    errors = []
    blocks = h.get("blocks", {})
    for name, b in blocks.items():
        if "present_centroid" not in b:
            errors.append(f"block {name}: missing present_centroid")
        parent = b.get("rides")
        if parent is not None:
            if parent not in blocks:
                errors.append(f"block {name}: rides unknown block {parent}")
            if blocks.get(parent, {}).get("rides") is not None:
                errors.append(f"block {name}: parent {parent} must not itself ride")
            if b.get("detach") is None and b.get("dock") is None:
                continue  # full-span attachment needs no keyframes
        kfs = b.get("keyframes", [])
        if not kfs:
            errors.append(f"block {name}: no keyframes")
            continue
        ts = [k["t"] for k in kfs]
        if ts != sorted(ts):
            errors.append(f"block {name}: keyframes not in ascending t order")
        if b.get("detach") is not None and ts[0] != b["detach"]:
            errors.append(f"block {name}: first keyframe must be at detach time {b['detach']}")
        if b.get("dock") is not None:
            if ts[-1] != b["dock"]:
                errors.append(f"block {name}: last keyframe must be at dock time {b['dock']}")
        elif ts[-1] != 0:
            errors.append(f"block {name}: last keyframe must be t=0 (present)")
        for k in kfs:
            if "c" not in k or len(k["c"]) != 2:
                errors.append(f"block {name}: keyframe t={k.get('t')} missing c=[lat,lon]")
    stage_ts = [s["t"] for s in h.get("stages", [])]
    if stage_ts != STAGE_TIMES:
        errors.append(f"stages must cover {STAGE_TIMES[0]}..0 every 50 Myr (got {stage_ts})")
    for s in h.get("stages", []):
        for e in s.get("events", []):
            if e.get("type") not in EVENT_TYPES:
                errors.append(f"stage {s['t']}: unknown event type {e.get('type')}")
            if e.get("type") == "orogeny" and e.get("class") not in OROGENY_CLASSES:
                errors.append(f"stage {s['t']}: orogeny needs class in {OROGENY_CLASSES}")
    return errors


def _slerp(v1, v2, f):
    dot = float(np.clip(v1 @ v2, -1, 1))
    omega = np.arccos(dot)
    if omega < 1e-9:
        return v1
    return (np.sin((1 - f) * omega) * v1 + np.sin(f * omega) * v2) / np.sin(omega)


def _keyframe_at(block, t):
    """Interpolated (lat, lon, spin) from a block's own keyframes."""
    kfs = block["keyframes"]
    if t <= kfs[0]["t"]:
        k = kfs[0]
        return k["c"][0], k["c"][1], k.get("spin", 0.0)
    for k0, k1 in zip(kfs[:-1], kfs[1:]):
        if k0["t"] <= t <= k1["t"]:
            f = (t - k0["t"]) / (k1["t"] - k0["t"]) if k1["t"] > k0["t"] else 1.0
            v = _slerp(latlon_to_xyz(*k0["c"]).reshape(3),
                       latlon_to_xyz(*k1["c"]).reshape(3), f)
            lat, lon = xyz_to_latlon(v)
            spin = k0.get("spin", 0.0) + f * (k1.get("spin", 0.0) - k0.get("spin", 0.0))
            return float(lat), float(lon), float(spin)
    k = kfs[-1]
    return k["c"][0], k["c"][1], k.get("spin", 0.0)


def _uses_parent(block, t):
    parent = block.get("rides")
    if parent is None:
        return False
    detach, dock = block.get("detach"), block.get("dock")
    if detach is None and dock is None:
        return True
    if detach is not None and t <= detach:
        return True
    if dock is not None and t >= dock:
        return True
    return False


def block_rotation(name, blocks, t):
    """3x3 matrix carrying present-day positions of block `name` to time t."""
    block = blocks[name]
    if _uses_parent(block, t):
        return block_rotation(block["rides"], blocks, t)
    plat, plon = block["present_centroid"]
    qlat, qlon, spin = _keyframe_at(block, t)
    p = latlon_to_xyz(plat, plon).reshape(3)
    q = latlon_to_xyz(qlat, qlon).reshape(3)
    axis = np.cross(p, q)
    n = np.linalg.norm(axis)
    if n < 1e-9:
        R_gc = np.eye(3)
    else:
        axis = axis / n
        ang = np.degrees(np.arccos(np.clip(p @ q, -1, 1)))
        alat, alon = xyz_to_latlon(axis)
        R_gc = rotation_matrix(alat, alon, ang)
    if abs(spin) > 1e-9:
        R_spin = rotation_matrix(qlat, qlon, spin)
        return R_spin @ R_gc
    return R_gc


def rotated_centroid(name, blocks, t):
    """(lat, lon) of the block's present centroid carried to time t."""
    R = block_rotation(name, blocks, t)
    p = latlon_to_xyz(*blocks[name]["present_centroid"]).reshape(3)
    lat, lon = xyz_to_latlon(R @ p)
    return float(lat), float(lon)


def attachment_pairs(blocks):
    """Set of (child, parent) pairs that are attached at some time."""
    return {(n, b["rides"]) for n, b in blocks.items() if b.get("rides")}
