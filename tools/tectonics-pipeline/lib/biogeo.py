"""Shared biogeography: Table-18 terrain classification and Miami NPP.

A Python port of `tools/regional-report/classify.mjs`, kept in sync with it.
Used by `scripts/97_biogeography.py` (province roll-up + habitat map) and
`scripts/98_continent_maps.py` (per-continent habitat panel) so both classify
land cells identically.
"""
import numpy as np

# Table-18 terrain classes, order identical to classify.mjs TERRAIN_CLASSES.
TERRAIN = ["Barren", "Desert sandy", "Desert rocky", "Scrub/brush", "Grass/savanna",
           "Prairie", "Steppe", "Forest light", "Forest medium", "Forest heavy",
           "Jungle medium", "Jungle heavy", "Marsh/swamp", "Moor", "Tundra", "Glacier"]
# macro-habitat for each terrain index, and the macro display order/colours.
MACRO_OF = {0: "Tundra/Alpine", 14: "Tundra/Alpine", 15: "Glacier",
            1: "Desert", 2: "Desert", 3: "Grass/Scrub", 4: "Grass/Scrub",
            5: "Grass/Scrub", 6: "Grass/Scrub", 7: "Forest", 8: "Forest", 9: "Forest",
            10: "Jungle", 11: "Jungle", 12: "Wetland", 13: "Wetland"}
MACRO_COLOR = {"Jungle": "#0a5a23", "Forest": "#2e8b57", "Grass/Scrub": "#bdb76b",
               "Desert": "#e8d27a", "Wetland": "#5f8c78", "Tundra/Alpine": "#b6b6a6",
               "Glacier": "#eef2f8"}


def temp_c(t):
    return -45.0 + np.clip(t, 0, 1) * 90.0


def classify_terrain(k, elev, pann, coastal):
    """Vectorised port of classify.mjs classifyTerrain (priority-ordered)."""
    terr = np.full(len(k), -1, np.int8)

    def setif(mask, val):
        terr[mask & (terr == -1)] = val

    setif(k == 30, 15)                                  # EF glacier
    setif(elev > 3.0, 0)                                # above treeline -> barren
    setif((k == 29) & (elev > 2.0), 0)                  # alpine ET -> barren
    setif(k == 29, 14)                                  # ET tundra
    setif((elev < 0.05) & coastal & (pann > 800) & (k >= 1) & (k <= 16), 12)  # marsh
    setif(k == 1, 11); setif(k == 2, 10)                # Af, Am
    setif((k == 3) & (pann >= 900), 7); setif(k == 3, 4)                       # Aw
    setif((k == 4) & (elev > 1.0), 2); setif(k == 4, 1)                        # BWh
    setif(k == 5, 2); setif(k == 6, 3); setif(k == 7, 6)                       # BWk BSh BSk
    setif(((k == 8) | (k == 14)) & (pann >= 1200), 9)
    setif((k == 8) | (k == 14), 8); setif(k == 9, 8)                           # Cfa/Cwa, Cfb
    setif((k == 10) & (pann >= 800), 13); setif(k == 10, 7)                    # Cfc
    setif((k == 11) | (k == 13), 3)                                            # Csa Csc
    setif((k == 12) & (pann >= 700), 7); setif(k == 12, 3)                     # Csb
    setif((k == 15) | (k == 16), 4)                                           # Cwb Cwc
    da = (k == 17) | (k == 21) | (k == 25)
    setif(da & (pann >= 600), 8); setif(da, 5)
    db = (k == 18) | (k == 22) | (k == 26)
    setif(db & (pann >= 500), 8); setif(db, 5)
    dsub = np.isin(k, [19, 20, 23, 24, 27, 28])
    setif(dsub & (pann < 350), 4); setif(dsub, 7)
    setif(terr == -1, 0)
    return terr


def miami_npp(k, tS, tW, pS, pW):
    """Ice-corrected Miami NPP (g/m²/yr); Köppen-EF (30) ice caps = 0."""
    T = (temp_c(tS) + temp_c(tW)) / 2.0
    P = (np.maximum(0, pS) + np.maximum(0, pW)) * 1000.0
    npp = np.minimum(3000.0 / (1.0 + np.exp(1.315 - 0.119 * T)),
                     3000.0 * (1.0 - np.exp(-0.000664 * P)))
    return np.where(k == 30, 0.0, npp)                  # ice-corrected (EF = 0)
