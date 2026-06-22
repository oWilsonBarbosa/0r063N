# Region 17 — Temperate coastline with offshore islands

Triangular face centered at 52.6°S 72.0°W · area 25,506,486 km² (1/20 of the planet).

![Region 17 terrain map](../maps/region_17.png)

*All percentages are area-weighted. Terrain colors are keyed in the [legend](../maps/legend.png).*

## At a Glance

| | |
|---|---|
| Hydrography | **Coastline with offshore islands** |
| Land share | 0.8 % (214,936 km²) |
| Dominant climate band | Temperate |
| Dominant terrain | Forest, medium |
| Mountain systems | 0 |
| Mean land temperature | 6.1 °C (Jun half-year) / 19.1 °C (Dec half-year) |
| Mean annual precipitation | 762 mm |

## Hydrography

Classified as **Coastline with offshore islands** (Table 15 vocabulary), based on:

- Land covers 0.8 % of the region.
- Largest land body: 95,201 km² (fully contained in this region).
- 33 island(s) ≥ 600 km² fully inside the region; 2 landmass(es) of continental scale or continuing beyond the region's edges.
- 3,293 km² of enclosed (landlocked) water.

## Landforms

No mountain system of significant extent (≥ 5,000 km²) rises in this region.

Relief of the land area:

| Lowlands (< 0.3 km) | Hills (0.3–0.8 km) | Highlands (0.8–2 km) | Mountains (> 2 km) |
|---|---|---|---|
| 60.0 % | 26.9 % | 10.7 % | 2.4 % |

## Climate

Climate-band composition of the land area (the book's five latitudinal bands, assigned from the simulated Köppen class of each cell):

| Tropical | Sub-tropical | Temperate | Sub-arctic | Arctic |
|---|---|---|---|---|
| 0.0 % | 9.1 % | 76.0 % | 3.8 % | 11.0 % |

Leading Köppen classes on land:

| Class | Type | Share of land |
|---|---|---|
| Cfb | Oceanic | 44.6 % |
| Csb | Warm-summer Mediterranean | 12.6 % |
| BSk | Cold steppe | 12.3 % |
| ET | Tundra | 11.0 % |
| Dfa | Hot-summer continental | 5.9 % |
| BSh | Hot steppe | 4.8 % |

## Prevailing Winds & Moisture

Wind direction is the direction the wind blows **from** (area-weighted mean over each quadrant); strength is relative to the planet-wide mean. "Variable" marks quadrants where the seasonal vectors largely cancel (monsoonal or convergence zones). Seasons follow the northern-hemisphere convention: "Jun" is the June–August half-year — southern-hemisphere summer is the Dec column.

| Quadrant | Jun wind | Dec wind | Land precip. | Regime | Rain shadow |
|---|---|---|---|---|---|
| NW | from NW, moderate | from NW, light | 592 mm (year-round) | sub-humid | — |
| NE | from NW, moderate | from WNW, moderate, variable | 1,119 mm (year-round) | humid | — |
| SW | from SE, light, variable | from SSE, light, variable | 1,156 mm (year-round) | humid | — |
| SE | from SE, light, variable | from SE, light, variable | 1,438 mm (year-round) | humid | — |

## Predominant Terrain

Terrain classes (Table 18 vocabulary) derived per cell from Köppen class, elevation and annual precipitation:

| Terrain | Share of land |
|---|---|
| Forest, medium | 52.3 % |
| Scrub / brushland | 12.5 % |
| Steppe | 12.3 % |
| Forest, light | 11.4 % |
| Tundra | 10.6 % |
| Barren | 0.7 % |
| Marsh / swamp | 0.2 % |

## Water Bodies

No enclosed seas or closed-basin lakes detected in this region.

## Rivers

No major river reaches the sea within this region — the land here is too arid, too fragmented, or drains into neighboring regions.

> **Method note.** Rivers and lakes are not part of the Orogen export; they are derived by this tool with standard terrain hydrology: priority-flood depression filling over the elevation raster, steepest-descent flow routing, and runoff from annual precipitation minus temperature-driven evapotranspiration (Ol'dekop curve). Only **closed-basin (endorheic) lakes** are reported as standing water: at the 0.125° grid, exorheic filled depressions are an over-detection artifact (unresolved river incision makes through-flowing valleys look ponded), whereas endorheic closure is resolution-robust — rivers are drawn straight through filled exorheic basins. The full consistency and plausibility checks are in [`HYDROLOGY_VALIDATION.md`](../HYDROLOGY_VALIDATION.md). Below-sea-level enclosed seas come directly from the export's elevation field.
