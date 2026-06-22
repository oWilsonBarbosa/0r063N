# Region 03 — Open ocean

Triangular face centered at 52.6°N 36.0°W · area 25,506,776 km² (1/20 of the planet).

![Region 03 terrain map](../maps/region_03.png)

*All percentages are area-weighted. Terrain colors are keyed in the [legend](../maps/legend.png).*

## At a Glance

| | |
|---|---|
| Hydrography | **Open ocean** |
| Land share | 0.1 % (14,176 km²) |
| Dominant climate band | — |
| Dominant terrain | — |
| Mountain systems | 0 |
| Mean land temperature | 12.8 °C (Jun half-year) / -9.8 °C (Dec half-year) |
| Mean annual precipitation | 1,477 mm |

## Hydrography

Classified as **Open ocean** (Table 15 vocabulary), based on:

- Land covers 0.1 % of the region.
- Largest land body: 8,605 km² (fully contained in this region).
- 3 island(s) ≥ 600 km² fully inside the region; 0 landmass(es) of continental scale or continuing beyond the region's edges.

## Landforms

No mountain system of significant extent (≥ 5,000 km²) rises in this region.

Relief of the land area:

| Lowlands (< 0.3 km) | Hills (0.3–0.8 km) | Highlands (0.8–2 km) | Mountains (> 2 km) |
|---|---|---|---|
| 95.4 % | 4.6 % | 0.0 % | 0.0 % |

## Climate

Climate-band composition of the land area (the book's five latitudinal bands, assigned from the simulated Köppen class of each cell):

| Tropical | Sub-tropical | Temperate | Sub-arctic | Arctic |
|---|---|---|---|---|
| 0.0 % | 0.0 % | 1.7 % | 98.3 % | 0.0 % |

Leading Köppen classes on land:

| Class | Type | Share of land |
|---|---|---|
| Dfc | Subarctic | 91.2 % |
| Dfb | Warm-summer continental | 7.1 % |
| Dfa | Hot-summer continental | 1.7 % |

## Prevailing Winds & Moisture

Wind direction is the direction the wind blows **from** (area-weighted mean over each quadrant); strength is relative to the planet-wide mean. "Variable" marks quadrants where the seasonal vectors largely cancel (monsoonal or convergence zones). Seasons follow the northern-hemisphere convention: "Jun" is the June–August half-year — southern-hemisphere summer is the Dec column.

| Quadrant | Jun wind | Dec wind | Land precip. | Regime | Rain shadow |
|---|---|---|---|---|---|
| NW | from NNE, light, variable | from NE, light, variable | 1,519 mm (year-round) | humid | — |
| NE | from ENE, light, variable | from NE, light, variable | 1,195 mm (year-round) | humid | — |
| SW | from SW, moderate, variable | from SW, moderate | 1,022 mm (year-round) | humid | — |
| SE | from SSW, moderate, variable | from SW, moderate | no land | — | — |

## Predominant Terrain

Terrain classes (Table 18 vocabulary) derived per cell from Köppen class, elevation and annual precipitation:

| Terrain | Share of land |
|---|---|
| Forest, light | 91.2 % |
| Forest, medium | 8.8 % |

## Water Bodies

No enclosed seas or closed-basin lakes detected in this region.

## Rivers

No major river reaches the sea within this region — the land here is too arid, too fragmented, or drains into neighboring regions.

> **Method note.** Rivers and lakes are not part of the Orogen export; they are derived by this tool with standard terrain hydrology: priority-flood depression filling over the elevation raster, steepest-descent flow routing, and runoff from annual precipitation minus temperature-driven evapotranspiration (Ol'dekop curve). Only **closed-basin (endorheic) lakes** are reported as standing water: at the 0.125° grid, exorheic filled depressions are an over-detection artifact (unresolved river incision makes through-flowing valleys look ponded), whereas endorheic closure is resolution-robust — rivers are drawn straight through filled exorheic basins. The full consistency and plausibility checks are in [`HYDROLOGY_VALIDATION.md`](../HYDROLOGY_VALIDATION.md). Below-sea-level enclosed seas come directly from the export's elevation field.
