"""
make_synthetic_data.py — ⚠️ GENERATES FAKE DATA FOR PIPELINE TESTING ONLY ⚠️

This creates a synthetic pre/post dataset SOLELY to demonstrate that the analysis
scripts run correctly. THE NUMBERS ARE NOT REAL and MUST NEVER be presented as
study findings. Delete or ignore this file's output once you have real data.

Every generated file is written with an obvious _SYNTHETIC_ prefix and a header
comment, so it cannot be mistaken for real participant data.
"""

import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)  # fixed seed -> reproducible fake data


def make(n=18, effect="realistic"):
    """Generate n participants' pre/post scores.

    effect:
      'realistic' -> a modest, believable improvement (what you'd hope to see)
      'null'      -> essentially no change (to prove the stats correctly say so)
    Kept deliberately imperfect (noise, a couple of non-improvers) so the pipeline
    is tested against messy data, not an idealised curve.
    """
    rows = []
    for i in range(1, n + 1):
        pid = f"P{i:02d}"
        # baseline ability varies per participant
        base = RNG.normal(0.40, 0.12)  # ~40% pre on average
        base = np.clip(base, 0.05, 0.85)
        if effect == "null":
            lift = RNG.normal(0.0, 0.05)
        else:
            lift = RNG.normal(0.28, 0.10)  # ~28pp average improvement, noisy
        post_frac = np.clip(base + lift, 0.0, 1.0)

        def draw(maxv, frac):
            return int(np.clip(round(RNG.binomial(maxv, np.clip(frac, 0, 1))), 0, maxv))

        for phase, frac in (("pre", base), ("post", post_frac)):
            w = draw(10, frac); c = draw(13, frac); cl = draw(10, frac)
            conf = draw(25, frac)  # confidence roughly tracks ability
            rows.append(dict(participant_id=pid, phase=phase,
                             score_web=w, score_container=c, score_cloud=cl,
                             score_total=w + c + cl, confidence=conf))
    return pd.DataFrame(rows)


if __name__ == "__main__":
    for eff in ("realistic", "null"):
        df = make(18, eff)
        path = f"_SYNTHETIC_{eff}_DO_NOT_USE_AS_RESULTS.csv"
        with open(path, "w") as f:
            f.write("# ⚠️ SYNTHETIC / FAKE DATA — for testing the analysis pipeline only.\n")
            f.write("# These numbers are randomly generated and are NOT study results.\n")
            df.to_csv(f, index=False)
        print(f"wrote {path}  ({len(df)} rows, {df.participant_id.nunique()} participants)")
