# Orogen regions full independent CSV parts manifest

Source: `orogen_regions_full.zip` / inner file `orogen_regions_full.csv`

Source ZIP SHA-256: `41a839e9fc32867713520fd5beefeb49acb814f3297ba7497fed97a7dead1e29`

Total data rows: **2,560,001**

Parts: **13** independent `.csv.gz` files. Each file contains the full header row and can be opened/read independently.

Split rule: 200,000 data rows per part, except the final part.

Fields (56): `id, lat, lon, x, y, z, elev, elev_km, prePost, eroD, plate, isOcPlate, superPlate, plateSpeed, isLand, isCoastal, isMountain, stress, orogPow, tecAct, base, tectonic, noise, interior, coastal_l, ocean_l, hotspot, margins, backArc, foldRidge, basin, koppen, contality, tempContality, tS, tW, pS, pW, wsS, wsW, prS, prW, windES, windNS, windEW, windNW, owS, owW, ocSpeedS, ocSpeedW, ocEastS, ocNorthS, ocEastW, ocNorthW, rsSummer, rsWinter`

| Part | File | Rows | First id | Last id | isLand=1 | isLand=0 | Size bytes | SHA-256 |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 00 | `orogen_regions_full_part_00.csv.gz` | 200,000 | 0 | 199999 | 17,481 | 182,519 | 31,627,636 | `fdb782e6bf3e0666af963ec7281bc198ef201a5ff7520e909298019afea94c8f` |
| 01 | `orogen_regions_full_part_01.csv.gz` | 200,000 | 200000 | 399999 | 33,511 | 166,489 | 32,046,185 | `b874819ffe28c6d67984846f5610e8ebcc942f574afd02feb7d708225a90f520` |
| 02 | `orogen_regions_full_part_02.csv.gz` | 200,000 | 400000 | 599999 | 27,164 | 172,836 | 32,822,592 | `a1b33d9998265db060c7e44f87d5260dffc07b685e9526451a3a7e961da13841` |
| 03 | `orogen_regions_full_part_03.csv.gz` | 200,000 | 600000 | 799999 | 32,205 | 167,795 | 33,524,039 | `abb875ac3725de5e6abfa93eb493a31569b5aa7bd8e7e5e6a75d0f9f2324608f` |
| 04 | `orogen_regions_full_part_04.csv.gz` | 200,000 | 800000 | 999999 | 47,188 | 152,812 | 34,027,627 | `a2bc5581c56c7e56a9e94a082f2166e89acbf4da4a38a0b508670c751125b6f8` |
| 05 | `orogen_regions_full_part_05.csv.gz` | 200,000 | 1000000 | 1199999 | 49,636 | 150,364 | 33,931,106 | `1aa5a0f37360fee5d2cd60713aa16e88276aa7202e8bf490c5d969dd7d60e134` |
| 06 | `orogen_regions_full_part_06.csv.gz` | 200,000 | 1200000 | 1399999 | 39,640 | 160,360 | 33,659,480 | `48c6447d49841d020db238289ec1b144ac8bfcf64d358bddf12ee4e74c5c4e97` |
| 07 | `orogen_regions_full_part_07.csv.gz` | 200,000 | 1400000 | 1599999 | 59,978 | 140,022 | 33,678,033 | `767ebb10969357c9c769f5e7b043dc0ba475cc83294a0b37e762756cb7d00096` |
| 08 | `orogen_regions_full_part_08.csv.gz` | 200,000 | 1600000 | 1799999 | 54,569 | 145,431 | 33,859,683 | `4dc9f95ab5a3f6e1696131d1881679873be731db76e9ce86e003d020457dc15a` |
| 09 | `orogen_regions_full_part_09.csv.gz` | 200,000 | 1800000 | 1999999 | 49,996 | 150,004 | 34,001,155 | `9a1f8420e8f85cc7a616ad196c5d2b9b5d0d0163959ea4cefc5dd7e4fd5c84ac` |
| 10 | `orogen_regions_full_part_10.csv.gz` | 200,000 | 2000000 | 2199999 | 53,972 | 146,028 | 33,657,427 | `68d1f3ad54eb04e5a9c6e38eba9722024ee847154685991001cf278934ef51f5` |
| 11 | `orogen_regions_full_part_11.csv.gz` | 200,000 | 2200000 | 2399999 | 52,575 | 147,425 | 33,474,765 | `16d71a5888d102b3a624ab2e20deea65814ec2d31d2e5ca482bf04cba3729dc1` |
| 12 | `orogen_regions_full_part_12.csv.gz` | 160,001 | 2400000 | 2560000 | 16,925 | 143,076 | 25,718,952 | `3b82318729776be6ebd01378d2835024b7201530a737dc376ba1dc763a7e761c` |

Validation:
- Total rows across parts: 2,560,001
- Total `isLand=1`: 534,840
- Total `isLand=0`: 2,025,161
- Every part has the original header.
