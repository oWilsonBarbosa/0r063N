"""Verify dependencies and data files before running the pipeline."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

failures = []

for mod in ("numpy", "pandas", "yaml"):
    try:
        m = __import__(mod)
        print(f"{mod} {getattr(m, '__version__', '?')}")
    except ImportError:
        failures.append(f"missing module: {mod} (pip install -r tectonics/requirements.txt)")

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot  # noqa: F401

    print(f"matplotlib {matplotlib.__version__} (Agg)")
except Exception as e:  # noqa: BLE001
    failures.append(f"matplotlib unusable: {e}")

from lib import data_io  # noqa: E402

try:
    paths = data_io.part_paths()
    sizes = {p.name: p.stat().st_size for p in paths}
    manifest = (data_io.DATA_DIR / "orogen_regions_full_csv_parts_manifest.md").read_text()
    for name, size in sizes.items():
        if name not in manifest:
            failures.append(f"part not in manifest: {name}")
        elif f"{size:,}" not in manifest:
            failures.append(f"size mismatch vs manifest: {name} ({size:,} bytes)")
    meta = data_io.load_meta()
    print(f"data: 13 parts OK, planet seed {meta['seed']}, "
          f"{meta['numRegions']:,} regions, {meta['landFractionPct']}% land")
except Exception as e:  # noqa: BLE001
    failures.append(f"data check failed: {e}")

if failures:
    print("\nENVIRONMENT CHECK FAILED:")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("environment OK")
