// Canonical physical-height mapping for the Orogen repository (JS).
//
// Converts the raw dimensionless model elevation `elev` to physical height in
// km. This is the repository's ONE canonical relief mapping, used by the atlas,
// continent stats, terrain classification, and every km-height product.
//
// It is the Earth-fitted power mapping selected in the relief/coast diagnostic
// (reports/audit/relief_coast_diagnostic/): a two-parameter land curve fitted to
// Earth's land median and its share of land at or above 2 km, giving an
// Earth-plausible distribution (land median ~0.42 km, ~10.7% of land >= 2 km,
// peak ~7.66 km) with no artificial ceiling. Ocean uses the shared linear scale.
//
// NOTE ON CLIMATE: the generator's exported climate (tS/tW, Koppen, precip,
// winds) was computed with the generator's own internal S-curve height curve
// (third_party/.../js/color-map.js elevToHeightKm) and is preserved as-is — it
// is the planet's published climate. This mapping governs physical relief and
// height reporting, not the (immutable) climate lapse used at export time.

export const HEIGHT_MAPPING_ID = 'earth_fitted_power_v1';
export const LAND_SCALE_KM = 4.574236096629359;
export const LAND_EXPONENT = 1.4622457219144074;

export function elevToHeightKm(elev) {
    if (elev <= 0) return elev * 10;              // ocean: -0.5 -> -5 km (shared)
    return LAND_SCALE_KM * Math.pow(elev, LAND_EXPONENT);
}
