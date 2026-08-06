// Canonical precipitation scale: normalized seasonal index -> millimetres.
//
// The export's `pS`/`pW` are dimensionless. Each is the raw seasonal
// precipitation field divided by its own 95th percentile and clamped to 1
// (see docs/DATA_DICTIONARY_V2.md), so converting them to millimetres needs an
// explicit scale — and every consumer must use the same one, or the repository
// reports two different planets.
//
// The scale is the generator's own `CLIMATE.KOPPEN_PRECIP_SCALE_MM`
// (js/climate-config.js). Its Köppen classifier converts this same index to
// millimetres with that constant before applying Köppen thresholds that are
// stated in real millimetres (`Af` driest month >= 60 mm, the `B` aridity
// threshold, the `Am`/`Aw` boundary), and the constant is registered in
// tuning/climate/param-space.mjs as high-impact and fitted by
// tuning/climate/optimize.mjs against observed Köppen-Geiger data. It is
// therefore already an Earth-calibrated estimate, and using it makes this
// repository's derived quantities consistent with the `koppen` column the
// generator exported.
//
// Verified by running the generator's climate chain on assets/earth.png at
// N=160,001 (tools/province-vectors/earth-calibration.mjs): the resulting
// global land mean is 720 mm/yr against Earth's observed ~715 mm/yr, and
// solving the scale directly from that land mean gives 832.9 — 0.7 % away.
//
// This replaces an earlier hardcoded 1000 in regional-report/classify.mjs,
// which overstated precipitation by ~19 %. See docs/culture/ §2.1.

/** Millimetres per unit of normalized seasonal precipitation index, per half-year. */
export const PRECIP_SCALE_MM = 838.5683;

/** Annual precipitation in mm from the two normalized seasonal indices. */
export function precipAnnualMm(pS, pW) {
    return (Math.max(0, pS) + Math.max(0, pW)) * PRECIP_SCALE_MM;
}
