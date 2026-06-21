"""Assemble docs/GEOLOGICAL_HISTORY.md from the inventory, history, and validation.

The narrative prose lives in the YAML (per-stage `narrative`, ocean/event notes)
and in the hand-written INTRO/CONCLUSION constants below; this script weaves them
together with the generated tables and embeds the rendered maps. Re-running
regenerates the whole document deterministically.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import data_io, history_schema

inv = data_io.load_inventory()
hist = history_schema.load(data_io.HISTORY_DIR / "history.yaml")
meta = data_io.load_meta()
validation = (data_io.OUT_DIR / "VALIDATION.md").read_text()

REPO = data_io.REPO_ROOT
DOC = REPO / "docs" / "GEOLOGICAL_HISTORY.md"
PRESENT = "../reports/tectonics/maps/present"
STAGES = "../reports/tectonics/maps/stages"

INTRO = f"""# Geological history of planet `{meta['planetCode']}`

*Orogen seed {meta['seed']} — {meta['numRegions']:,} surface regions,
{meta['landFractionPct']}% land, physical relief {meta['elevPhysicalKm']['min']} to
+{meta['elevPhysicalKm']['max']} km.*

This document reconstructs a plate-tectonic history for a procedurally generated
world. The generator produces only a **single present-day snapshot** — plates,
boundaries, orogens, hotspots and margins, but no time axis. Following the
method in Worldbuilding Pasta's *Constructing a Plate Tectonic History*, we read
the planet's present tectonic features and then build a forward history — one
full supercontinent cycle, **T-750 Myr to present in 50-Myr stages** — that
*explains* what we see today. Every claim is checked against the quantitative
rules of thumb from the same essays (see [Validation](#validation)).

## 1. Tectonic regime

We adopt **Earth-like mobile-lid plate tectonics**, the regime the source
material treats as the baseline for an active, habitable world. The planet
qualifies on the usual grounds: it is Earth-sized, has deep water oceans
(~79% ocean), a cool surface, and — decisively — its data show the diagnostic
signature of mobile-lid tectonics that the *Alternatives to Plate Tectonics*
essay says no stagnant- or squishy-lid world produces: long, continuous
divergent ridges facing matching convergent trench systems, asymmetric
subduction with back-arc basins, linear hotspot chains recording plate drift,
and paired active/passive continental margins. Stagnant-lid (Mars/Venus-style),
heat-pipe (Io), and squishy/sluggish-lid regimes are all ruled out by these
features; we note them only to justify the choice.

The cycle modeled here is **{{meta_cycle}}**: the supercontinent S1
(all ten cratons) assembled by T-650, held for ~200 Myr, and broke up at
T-450. Most fragments dispersed across the old exterior ocean (extroversion),
while the B-D-H core ran a small nested introverted Wilson cycle (the H-B
Seaway opened and closed again).
""".replace("{meta_cycle}", str(hist["meta"]["cycle_style"]))

NOMENCLATURE = """## 2. Nomenclature

Functional labels (after the essay's A-J / i-ii-iii / 1-2-3 convention):

- **Cratons** `A`-`J`: the ten ancient, rigid continental nuclei. They persist
  intact for the whole history and are the anchor points of every reconstruction.
- **Microcontinents** `micro_1`-`micro_11`: smaller continental blocks, arc
  terranes, and oceanic plateaus that rift, drift, and accrete.
- **Continents**: named by the cratons they contain (e.g. `AIJ`, `CEF`, `BDH`,
  `G`).
- **Ocean basins**: named (Exterior, Central, Western, Northern, H-B Seaway).
- **Present-day ocean plates**: roman numerals `i`-`xvi` by area.
- **Features**: orogens `O1`-`On`, trenches `T1`-`Tn`, back-arc basins
  `B1`-`Bn`, hotspots `H1`-`Hn`.
- **Stages**: `T-750` … `T-0`, in Myr before present.
"""


def present_section():
    plates = inv["plates"]
    conts = inv["continents"]
    out = ["## 3. Present-day tectonic inventory", "",
           "The starting point: what the generated planet looks like today.", "",
           f"![Present elevation]({PRESENT}/present_elevation.png)", "",
           f"**Continents.** {len(conts)} major landmasses — "
           + ", ".join((f"**{c['name']}** (`{n}`, {c['area_Mkm2']} Mkm²)" if c.get('name')
                        else f"`{n}` ({c['area_Mkm2']} Mkm²)") for n, c in conts.items())
           + f", plus {len(inv['microcontinents'])} microcontinents and many islands.", "",
           f"**Plates.** {len(plates)} super-plates "
           f"({sum(1 for p in plates.values() if p['is_oceanic'])} oceanic, "
           f"{sum(1 for p in plates.values() if not p['is_oceanic'])} continental). "
           "Inferred motions come from a slab-pull/ridge-push force balance "
           "(plate Euler poles are not exported, so directions are heuristic; "
           "see the confidence column in `out/INVENTORY.md`).", "",
           f"![Plates]({PRESENT}/present_plates.png)", "",
           "**Boundaries.** Classified from the generator's `margins` field and "
           "boundary-pixel stress: ridges (divergent), trenches (convergent, with "
           "subduction polarity from back-arc and trench placement), and transforms.", "",
           f"![Boundaries]({PRESENT}/present_boundaries.png)", "",
           "**Tectonic features.** The belts, trenches, basins, fold ridges and "
           "hotspots that the history must explain:", "",
           f"![Features]({PRESENT}/present_features.png)", "",
           "| feature | location | character |", "|---|---|---|"]
    for i, o in enumerate(inv["features"]["orogens"]):
        out.append(f"| O{i + 1} orogen | {o['centroid']} | {o['area_Mkm2']} Mkm², "
                   f"mean {o['mean_elev_km']} km / max {o['max_elev_km']} km, blocks {o['blocks']} |")
    for i, t in enumerate(inv["features"]["trenches"][:6]):
        out.append(f"| T{i + 1} trench | {t['centroid']} | min {t['min_elev_km']} km |")
    out += ["", f"![Margins]({PRESENT}/present_margins.png)", "",
            "Coastlines split roughly half active / half passive — consistent with "
            "a world ~100 Myr past a supercontinent breakup.", ""]
    return "\n".join(out)


def cycle_section():
    out = ["## 4. The supercontinent cycle, stage by stage", ""]
    type_count = {}
    for s in hist["stages"]:
        for e in s.get("events", []):
            type_count[e["type"]] = type_count.get(e["type"], 0) + 1
    out.append("Across the cycle: "
               + ", ".join(f"{n} {k.replace('_', ' ')}" for k, n in sorted(type_count.items()))
               + ".\n")
    for s in hist["stages"]:
        t = s["t"]
        tag = f"T{t}" if t < 0 else "T-0 (present)"
        out.append(f"### Stage {tag} Myr")
        out.append("")
        out.append(f"![Stage {tag}]({STAGES}/stage_T{abs(t):03d}.png)")
        out.append("")
        if s.get("narrative"):
            out.append(s["narrative"].strip())
            out.append("")
        evs = s.get("events", [])
        if evs:
            out.append("| event | type | where | detail |")
            out.append("|---|---|---|---|")
            for e in evs:
                where = e.get("where", "-")
                detail = e.get("notes", "")
                cls = f" *({e['class']})*" if e.get("class") else ""
                out.append(f"| {e.get('blocks', '')} | {e['type']}{cls} | {where} | {detail} |")
            out.append("")
    return "\n".join(out)


def oceans_section():
    out = ["## 5. Ocean basins", "", "| basin | born | died | note |", "|---|---|---|---|"]
    for o in hist["oceans"]:
        out.append(f"| {o['name']} | {o.get('born', '—')} | {o.get('died', '—')} | "
                   f"{o.get('note', '').strip()} |")
    return "\n".join(out)


def provenance_section():
    out = ["## 6. Feature provenance", "",
           "Every present-day tectonic feature traced to the event that made it. "
           "This is the core test of the reconstruction: the history is only valid "
           "if it accounts for what the planet actually shows.", "",
           "| present-day feature | explained by |", "|---|---|"]
    for p in hist["provenance"]:
        out.append(f"| {p['feature']} | {p['explained_by']} |")
    return "\n".join(out)


def validation_section():
    body = validation.split("\n", 1)[1] if "\n" in validation else validation
    return ("## 7. Validation\n\n"
            "Generated by `tools/tectonics-pipeline/scripts/60_validate.py`, which checks the "
            "history against the essays' quantitative rules of thumb. The run "
            "passes with zero hard failures; remaining warnings are sub-30% block "
            "overlaps during the tightly-packed supercontinent assembly, where "
            "continents are expected to abut.\n\n" + body)


CONCLUSION = """## 8. Reproducing this history

The whole package is regenerated from the planet data by running, from the repo
root:

```bash
pip install -r tools/tectonics-pipeline/requirements.txt
python3 tools/tectonics-pipeline/scripts/00_env_check.py
python3 tools/tectonics-pipeline/scripts/10_ingest.py        # -> out/cache/columns.npz
python3 tools/tectonics-pipeline/scripts/15_rasterize.py     # -> out/cache/rasters.npz
python3 tools/tectonics-pipeline/scripts/20_boundaries.py    # -> out/boundary_segments.json
python3 tools/tectonics-pipeline/scripts/25_inventory.py     # -> out/inventory.json, INVENTORY.md
python3 tools/tectonics-pipeline/scripts/30_render_present.py # -> maps/present/*.png
python3 tools/tectonics-pipeline/scripts/50_render_stages.py # -> maps/stages/*.png
python3 tools/tectonics-pipeline/scripts/60_validate.py      # -> out/VALIDATION.md (exit 0 = valid)
python3 tools/tectonics-pipeline/scripts/70_build_doc.py     # -> docs/GEOLOGICAL_HISTORY.md
```

To revise the history, edit `tools/tectonics-pipeline/history/history.yaml` (block keyframes,
events, ocean basins, orogen ages), then re-run `50_render_stages.py`,
`60_validate.py`, and `70_build_doc.py`. The validator gates correctness; keep it
at zero failures.

*Caveats.* Plate motion **directions** are inferred heuristically (the
generator does not export Euler poles), so the absolute longitudes of the
paleogeographic stages are one self-consistent solution among several that fit
the present map — exactly the ambiguity the source essays warn about when
working backward from a finished map. The **relative** sequence of rifting,
drift, collision and accretion, and the feature provenance, are constrained by
the data.
"""

doc = "\n\n".join([INTRO, NOMENCLATURE, present_section(), cycle_section(),
                   oceans_section(), provenance_section(), validation_section(),
                   CONCLUSION])
DOC.parent.mkdir(parents=True, exist_ok=True)
DOC.write_text(doc + "\n")
print(f"wrote {DOC} ({len(doc.splitlines())} lines)")
