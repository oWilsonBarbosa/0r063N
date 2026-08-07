// Canonical precipitation scale: normalized seasonal index -> millimetres.
//
// The export's `pS`/`pW` are dimensionless. Each is the raw seasonal
// precipitation field divided by its own 95th percentile and clamped to 1
// (see docs/DATA_DICTIONARY_V2.md), so converting them to millimetres needs an
// explicit scale — and every consumer must use the same one, or the repository
// reports two different planets.
//
// The scale must be fitted to the generator *that produced this export*, which
// orogen_meta_full_v2.json pins as snapshot f9bb081 (2026-04-15). That matters:
// the generator has changed substantially since, and its climate constants are
// not transferable backwards.
//
//   - At f9bb081, js/koppen.js hardcoded `* 1000` as the index->mm conversion.
//     That was a placeholder, not a calibration — which is why the later
//     climate-tuning commit (bae1a1e) replaced it with a fitted parameter.
//     Against real Earth it runs ~23 % high.
//   - The current generator's CLIMATE.KOPPEN_PRECIP_SCALE_MM is 838.5683, but
//     it was fitted to the *current* precipitation model, not the one that
//     produced this dataset. Applied here it is ~3 % high.
//
// The value below is fitted to f9bb081 itself, by running that snapshot's own
// climate chain on assets/earth.png at N=160,001 and solving for the scale that
// reproduces Earth's observed global land mean of ~715 mm/yr
// (tools/province-vectors/earth-calibration-snapshot.mjs):
//
//   land mean under 1000      -> 879 mm/yr  (+23 %)
//   land mean under 838.5683  -> 737 mm/yr  (+3.1 %)
//   land mean under 813.7     -> 715 mm/yr  (fitted)
//
// Corroborating: that snapshot censors 13.48 % of Earth land cells at the p95
// cap, closely matching this planet's own 13.80 %. The current generator gives
// 19.84 %, further confirming f9bb081 as the correct reference.
//
// CAVEAT. The exported `koppen` column was classified by the generator using
// its uncalibrated 1000, so millimetres on this scale will not exactly
// reproduce the Köppen boundaries stored beside them. That is unavoidable: the
// labels are immutable canon computed with a placeholder. Physical accuracy is
// preferred here because the thresholds these millimetres feed — terrain
// classes, humidity bands, D-PLACE `Bio12` filters — are all stated in real
// millimetres and compared against real-world data. See docs/culture/ §2.1.

/** Millimetres per unit of normalized seasonal precipitation index, per half-year. */
export const PRECIP_SCALE_MM = 813.7;

/** Annual precipitation in mm from the two normalized seasonal indices. */
export function precipAnnualMm(pS, pW) {
    return (Math.max(0, pS) + Math.max(0, pW)) * PRECIP_SCALE_MM;
}
