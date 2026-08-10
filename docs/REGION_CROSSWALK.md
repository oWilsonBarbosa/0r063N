# Regions ↔ Continents

Two independent partitions of the same planet, joined cell-for-cell.

- The **regional gazetteers** ([`reports/regional/`](../reports/regional/README.md)) cut the globe into the **20 triangular faces of an icosahedron** (regions 01–20, each ≈25.5 Mkm²): regions 01–05 ring the north pole, 06–15 span the equatorial belt, 16–20 ring the south pole.
- The **continent analyses** ([`CONTINENTS.md`](CONTINENTS.md), [`BIOGEOGRAPHY.md`](BIOGEOGRAPHY.md)) group land into the four connected landmasses **Meridia, Sirocca, Selvana, Borea**, plus an `Islands` bucket of detached land.

Every land cell has both a region (its icosahedral face) and a continent (its connected landmass), so the two frames join exactly. The continent totals below match [`CONTINENTS.md`](CONTINENTS.md) cell-for-cell; the mesh is uniform-on-sphere, so cell counts are an area proxy (≈199 km²/cell).

## Each region → its continents

For every face: centre, land share (of the whole face), and how that land splits across the continents. The **dominant** continent is bold; percentages are of the region's *land*.

| Region | Centre | Land share | Meridia | Sirocca | Selvana | Borea | Islands |
|---|---|---:|---:|---:|---:|---:|---:|
| [01](../reports/regional/regions/region_01.md) | 52.6°N 180.0°E | 6.5 % | **54.8** | – | – | 27.7 | 17.5 |
| [02](../reports/regional/regions/region_02.md) | 52.6°N 108.0°W | 49.9 % | **97.9** | – | – | – | 2.1 |
| [03](../reports/regional/regions/region_03.md) | 52.6°N 36.0°W | 0.1 % | – | – | – | – | **100.0** |
| [04](../reports/regional/regions/region_04.md) | 52.6°N 36.0°E | 20.5 % | – | – | – | **93.9** | 6.1 |
| [05](../reports/regional/regions/region_05.md) | 52.6°N 108.0°E | 54.9 % | – | – | – | **98.6** | 1.4 |
| [06](../reports/regional/regions/region_06.md) | 10.8°N 108.0°W | 40.5 % | **91.4** | – | 3.1 | – | 5.4 |
| [07](../reports/regional/regions/region_07.md) | 10.8°N 36.0°W | 0.0 % | 31.7 | – | – | – | **68.3** |
| [08](../reports/regional/regions/region_08.md) | 10.8°N 36.0°E | 15.9 % | – | **98.9** | – | – | 1.1 |
| [09](../reports/regional/regions/region_09.md) | 10.8°N 108.0°E | 4.7 % | – | – | – | **72.6** | 27.4 |
| [10](../reports/regional/regions/region_10.md) | 10.8°N 180.0°E | 12.2 % | 1.6 | – | **92.3** | – | 6.0 |
| [11](../reports/regional/regions/region_11.md) | 10.8°S 72.0°E | 14.7 % | – | **95.2** | – | – | 4.8 |
| [12](../reports/regional/regions/region_12.md) | 10.8°S 144.0°W | 52.1 % | 0.1 | – | **96.8** | – | 3.0 |
| [13](../reports/regional/regions/region_13.md) | 10.8°S 72.0°W | 21.1 % | **97.2** | – | – | – | 2.8 |
| [14](../reports/regional/regions/region_14.md) | 10.8°S 0.0°W | 14.0 % | – | **97.6** | – | – | 2.4 |
| [15](../reports/regional/regions/region_15.md) | 10.8°S 144.0°E | 0.1 % | – | – | – | – | **100.0** |
| [16](../reports/regional/regions/region_16.md) | 52.6°S 144.0°W | 44.1 % | – | – | **97.9** | – | 2.1 |
| [17](../reports/regional/regions/region_17.md) | 52.6°S 72.0°W | 0.8 % | – | – | – | – | **100.0** |
| [18](../reports/regional/regions/region_18.md) | 52.6°S 0.0°W | 17.8 % | – | **91.2** | – | – | 8.8 |
| [19](../reports/regional/regions/region_19.md) | 52.6°S 72.0°E | 47.8 % | – | **99.3** | – | – | 0.7 |
| [20](../reports/regional/regions/region_20.md) | 52.6°S 144.0°E | 0.1 % | – | – | – | – | **100.0** |

## Each continent → its regions

Which gazetteers to open for each continent, with the share of the continent's land each face holds (descending). Faces holding < 1 % are folded into “+ n more”.

| Continent | Area (Mkm²) | Land cells | Gazetteers (share of continent land) |
|---|---:|---:|---|
| **Meridia** | 28.34 | 141,125 | [02](../reports/regional/regions/region_02.md) 44 % · [06](../reports/regional/regions/region_06.md) 34 % · [13](../reports/regional/regions/region_13.md) 19 % · [01](../reports/regional/regions/region_01.md) 3 % · + 3 more |
| **Sirocca** | 27.5 | 137,103 | [19](../reports/regional/regions/region_19.md) 44 % · [18](../reports/regional/regions/region_18.md) 15 % · [08](../reports/regional/regions/region_08.md) 15 % · [11](../reports/regional/regions/region_11.md) 13 % · [14](../reports/regional/regions/region_14.md) 13 % |
| **Selvana** | 27.33 | 135,809 | [12](../reports/regional/regions/region_12.md) 48 % · [16](../reports/regional/regions/region_16.md) 41 % · [10](../reports/regional/regions/region_10.md) 11 % · [06](../reports/regional/regions/region_06.md) 1 % |
| **Borea** | 20.17 | 100,601 | [05](../reports/regional/regions/region_05.md) 69 % · [04](../reports/regional/regions/region_04.md) 24 % · [09](../reports/regional/regions/region_09.md) 4 % · [01](../reports/regional/regions/region_01.md) 2 % |

## The Western Lands, located

For the [Western Lands deep dive](WESTERN_LANDS.md): **Meridia**'s land sits mainly in [02](../reports/regional/regions/region_02.md) (44 %) · [06](../reports/regional/regions/region_06.md) (34 %) · [13](../reports/regional/regions/region_13.md) (19 %); **Selvana**'s in [12](../reports/regional/regions/region_12.md) (48 %) · [16](../reports/regional/regions/region_16.md) (41 %) · [10](../reports/regional/regions/region_10.md) (11 %) (shares of each continent's land). The near-landless **open-ocean faces** above — [03](../reports/regional/regions/region_03.md), [07](../reports/regional/regions/region_07.md), [15](../reports/regional/regions/region_15.md), [17](../reports/regional/regions/region_17.md), [20](../reports/regional/regions/region_20.md) — carry the basins around them, including the Western Ocean that rifted the two apart; the deep dive ties that ocean to its tectonic stage. This crosswalk is what lets that chapter send a reader from a continent straight to the gazetteers that map it.

---

Generated by `tools/tectonics-pipeline/scripts/96_region_crosswalk.py` (data: `reports/tectonics/region_continent_crosswalk.{json,csv}`). Region definition: `tools/regional-report/icosahedron.mjs`; continent definition: `tools/tectonics-pipeline/lib/continents.py`.
