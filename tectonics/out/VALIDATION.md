# History validation

## Block speeds (cm/yr per 50-Myr stage)

| block | max speed | stage | verdict |
|---|---:|---|---|
| A | 2.02 | T-200..T-150 | ok |
| B | 1.46 | T-750..T-700 | ok |
| C | 1.93 | T-100..T-50 | ok |
| D | 1.23 | T-750..T-700 | ok |
| E | 2.38 | T-200..T-150 | ok |
| F | 2.59 | T-150..T-100 | ok |
| G | 1.80 | T-50..T0 | ok |
| H | 1.51 | T-200..T-150 | ok |
| I | 3.19 | T-350..T-300 | ok |
| J | 2.84 | T-350..T-300 | ok |
| micro_1 | 3.05 | T-100..T-50 | ok |
| micro_2 | 2.15 | T-200..T-150 | ok |
| micro_3 | 0.27 | T-600..T-550 | ok |
| micro_4 | 2.11 | T-200..T-150 | ok |
| micro_5 | 0.25 | T-400..T-350 | ok |
| micro_6 | 1.75 | T-200..T-150 | ok |
| micro_7 | 1.79 | T-100..T-50 | ok |
| micro_8 | 2.55 | T-100..T-50 | ok |
| micro_9 | 0.78 | T-50..T0 | ok |
| micro_10 | 1.09 | T-750..T-700 | ok |
| micro_11 | 0.54 | T-450..T-400 | ok |

## Oceans and cycle timing

- EXT (Exterior Ocean): open basin (crust renewed at its ridges)
- CENTRAL (Central Ocean): open basin (crust renewed at its ridges)
- WESTERN (Western Ocean): open basin (crust renewed at its ridges)
- NORTHERN (Northern Ocean): open basin (crust renewed at its ridges)
- HB (H-B Seaway): basin life 350 Myr
- S1 assembled T-650, breakup T-450: tenure 200 Myr
- modeled cycle span 750 Myr (rule of thumb 400-750)

## Orogen heights vs erosion model (2500 m - 5 m/Myr x age)

| orogen | event stage | age Myr | predicted mean m | observed mean m | verdict |
|---|---|---:|---:|---:|---|
| O1 | T-200 | 200 | 1500 | 1580 | ok |
| O2 | T-100 | 100 | 2000 | 1890 | ok |
| O3 | T-200 | 200 | active belt | 1530 | exempt (still building) |
| O4 | T-250 | 250 | 1250 | 1150 | ok |
| O5 | T-50 | 50 | active belt | 2650 | exempt (still building) |
| O6 | T-50 | 50 | active belt | 2340 | exempt (still building) |
| O7 | T-50 | 50 | active belt | 400 | exempt (still building) |

## Provenance coverage

- all 42 present-day features have an explaining event

## Block overlaps

- stage T-750: C overlaps micro_10 by 13%
- stage T-750: E overlaps H by 15%
- stage T-700: C overlaps H by 17%
- stage T-700: C overlaps micro_10 by 14%
- stage T-400: micro_4 overlaps micro_6 by 29%
- stage T-250: B overlaps micro_6 by 13%
- stage T-250: H overlaps micro_10 by 13%

## Endpoint and conservation

- all blocks end at their present positions with zero spin
- all 10 cratons persist across the full span

## Hotspots and LIPs

- hotspot tracks confined to the last 100 Myr
- LIPs: 5 at stages [-550, -500, -450, -400, -350] (rule of thumb ~5 per breakup)

## Summary

- failures: 0
- warnings: 7

- warn: stage T-750: C overlaps micro_10 by 13%
- warn: stage T-750: E overlaps H by 15%
- warn: stage T-700: C overlaps H by 17%
- warn: stage T-700: C overlaps micro_10 by 14%
- warn: stage T-400: micro_4 overlaps micro_6 by 29%
- warn: stage T-250: B overlaps micro_6 by 13%
- warn: stage T-250: H overlaps micro_10 by 13%
