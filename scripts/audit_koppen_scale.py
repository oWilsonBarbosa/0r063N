#!/usr/bin/env python3
"""Measure how many land cells the precipitation-scale change reclassifies.

The stored `koppen` column was classified by the generator using the placeholder
1000 mm per unit. The repository now reports millimetres at the calibrated
PRECIP_SCALE_MM = 813.7. Koppen's aridity test is defined in millimetres, so the
two disagree near the arid boundary.

Reproduces the pinned generator's test exactly (js/koppen.js:184-212 at f9bb081,
where KOPPEN_ARIDITY_SCALE = 1 and KOPPEN_EAST_COAST_WET = 0, so PannArid = Pann):

    Tann     = (tempC(tS) + tempC(tW)) / 2
    Pann     = (pS + pW) * SCALE
    PsumLoc  = (lat >= 0 ? pS : pW) * SCALE      # hemisphere-corrected warm season
    frac     = PsumLoc / Pann                     # scale-INVARIANT
    Pthresh  = 20*Tann + (280 if frac>=0.7 else 0 if frac<=0.3 else 140), floored at 0
    arid     <=> Pann < Pthresh
    desert   <=> Pann < Pthresh/2   (else steppe)

Because frac and therefore Pthresh are scale-invariant, only Pann moves.
"""
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path('/home/user/0r063N/tools/tectonics-pipeline')))
from lib import data_io

OLD, NEW = 1000.0, 813.7

cols = data_io.load_columns(["lat", "pS", "pW", "tS", "tW", "isLand", "koppen"])
land = cols["isLand"] == 1
lat = cols["lat"][land]
pS = np.maximum(0.0, cols["pS"][land].astype(np.float64))
pW = np.maximum(0.0, cols["pW"][land].astype(np.float64))
tS = cols["tS"][land].astype(np.float64)
tW = cols["tW"][land].astype(np.float64)
kop = cols["koppen"][land].astype(int)
n = land.sum()
print(f"land cells: {n:,}\n")

tempC = lambda t: -45.0 + np.clip(t, 0, 1) * 90.0
Tann = (tempC(tS) + tempC(tW)) / 2.0

idx = pS + pW
Pann_old, Pann_new = idx * OLD, idx * NEW
PsumLoc = np.where(lat >= 0, pS, pW)                  # hemisphere-corrected
with np.errstate(divide="ignore", invalid="ignore"):
    frac = np.where(idx > 0, PsumLoc / idx, 0.5)      # scale-invariant

Pthresh = np.where(frac >= 0.7, 20 * Tann + 280,
          np.where(frac <= 0.3, 20 * Tann, 20 * Tann + 140))
Pthresh = np.maximum(0.0, Pthresh)

arid_old, arid_new = Pann_old < Pthresh, Pann_new < Pthresh
des_old = arid_old & (Pann_old < Pthresh / 2)
des_new = arid_new & (Pann_new < Pthresh / 2)

newly_arid = arid_new & ~arid_old
newly_des  = des_new & ~des_old & arid_old          # steppe -> desert within B

print("ARID (B group) boundary")
print(f"  arid at 1000 (as classified) : {arid_old.sum():>8,}  ({100*arid_old.mean():5.2f}% of land)")
print(f"  arid at  813.7 (as reported) : {arid_new.sum():>8,}  ({100*arid_new.mean():5.2f}% of land)")
print(f"  NEWLY arid                   : {newly_arid.sum():>8,}  ({100*newly_arid.mean():5.2f}% of land)")
print()
print("DESERT vs STEPPE boundary (within cells already arid)")
print(f"  steppe -> desert             : {newly_des.sum():>8,}  ({100*newly_des.mean():5.2f}% of land)")
print()
total = newly_arid | newly_des
print(f"TOTAL cells whose Koppen label the calibrated scale would change:")
print(f"  {total.sum():,}  ({100*total.mean():.2f}% of land)")
print()

# Which stored classes are the newly-arid cells drawn from?
if newly_arid.any():
    codes = {1:'Af',2:'Am',3:'Aw',4:'BWh',5:'BWk',6:'BSh',7:'BSk',8:'Cfa',9:'Cfb',10:'Cfc',
             11:'Csa',12:'Csb',13:'Csc',14:'Cwa',15:'Cwb',16:'Cwc',17:'Dfa',18:'Dfb',19:'Dfc',
             20:'Dfd',21:'Dsa',22:'Dsb',23:'Dsc',24:'Dsd',25:'Dwa',26:'Dwb',27:'Dwc',28:'Dwd',
             29:'ET',30:'EF'}
    u, c = np.unique(kop[newly_arid], return_counts=True)
    print("newly-arid cells, by their STORED label:")
    for k, cnt in sorted(zip(u, c), key=lambda x: -x[1])[:8]:
        print(f"  {codes.get(int(k), k):<4} {cnt:>7,}  ({100*cnt/newly_arid.sum():4.1f}% of the newly arid)")
