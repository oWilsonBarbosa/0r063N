"""Canonical physical-height mapping for the Orogen repository (Python).

Mirrors tools/height-mapping.mjs. Converts the raw dimensionless model
elevation `elev` to physical height in km using the Earth-fitted power land
curve selected in the relief/coast diagnostic (reports/audit/
relief_coast_diagnostic/): Earth-plausible distribution (land median ~0.42 km,
~10.7% of land >= 2 km, peak ~7.66 km), no artificial ceiling. Ocean uses the
shared linear scale.

The stored `elev_km` column is the LEGACY linear mapping; do not use it for
physical height. Apply these functions to the raw `elev` field instead.
"""

import numpy as np

HEIGHT_MAPPING_ID = "earth_fitted_power_v1"
LAND_SCALE_KM = 4.574236096629359
LAND_EXPONENT = 1.4622457219144074


def elev_to_height_km(elev):
    """Scalar or array raw elev -> physical height in km (canonical mapping)."""
    elev = np.asarray(elev, dtype=np.float64)
    return np.where(elev > 0, LAND_SCALE_KM * np.power(np.clip(elev, 0, None), LAND_EXPONENT), elev * 10.0)
