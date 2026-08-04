"""The orogen height-vs-age erosion model — one definition, two consumers.

A mountain belt is built to a characteristic summit height at its formation stage
and decays roughly linearly with age. This single law is used by BOTH:

  - scripts/60_validate.py    - checks each inactive belt's PRESENT mean height
                                against the prediction for its age.
  - scripts/80_paleoclimate.py - scales belt elevations backwards in time so each
                                stage's paleoclimate sees the belts as they were.

Keeping it here prevents the two from drifting apart: they previously carried
independent copies (1300 - 3*age vs 2500 - 5*age), which silently produced
validation results and paleoclimate products under different physical laws.

Calibration: recalibrated together with the canonical Earth-fitted power height
mapping (`lib/height.py`, `tools/height-mapping.mjs`). Under that mapping the
observed belt heights are lower than under the old linear `elev_km`, so the
initial height and decay rate were refit accordingly.
"""

# Characteristic summit height of a freshly formed belt, in metres.
INITIAL_HEIGHT_M = 1300.0
# Linear decay of that height, in metres per Myr of age.
DECAY_M_PER_MYR = 3.0
# Belts do not erode to nothing: residual basement/root support, in metres.
FLOOR_M = 300.0

# Human-readable form, for docs and comments. Keep in sync with the constants.
MODEL_TEXT = "1300 m − 3 m/Myr × age (floor 300 m)"


def predicted_height_m(age_myr):
    """Predicted mean belt height (metres) for a belt of the given age (Myr).

    age_myr is time SINCE formation and must be >= 0.
    """
    return max(INITIAL_HEIGHT_M - DECAY_M_PER_MYR * age_myr, FLOOR_M)
