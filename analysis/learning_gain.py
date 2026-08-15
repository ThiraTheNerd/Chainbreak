from __future__ import annotations
import pandas as pd
import numpy as np
from scipy import stats
from dataclasses import dataclass, field
from typing import Optional


# --------------------------------------------------------------------------- #
# Configuration: adjust these to match the real assessment instrument.
# --------------------------------------------------------------------------- #
KNOWLEDGE_MAX = 33          # total knowledge items (10 web + 13 container + 10 cloud)
DOMAIN_MAX = {"web": 10, "container": 13, "cloud": 10}
CONFIDENCE_MAX = 25         # 5 items x 5-point Likert
ALPHA = 0.05               # significance threshold


def expected_schema() -> str:
    return (
        "Expected tidy CSV, one row per participant per phase:\n"
        "  participant_id : str/int  (anonymised code, e.g. P01)\n"
        "  phase          : 'pre' | 'post'\n"
        "  score_web      : int  (0..10)\n"
        "  score_container: int  (0..13)\n"
        "  score_cloud    : int  (0..10)\n"
        "  score_total    : int  (0..33)   [optional; recomputed if absent]\n"
        "  confidence     : int  (0..25)   [optional]\n"
        "Each participant must appear exactly twice: one 'pre' and one 'post'.\n"
    )


# --------------------------------------------------------------------------- #
# Loading & validation
# --------------------------------------------------------------------------- #
def load_scores(csv_path: str) -> pd.DataFrame:
    """Load and validate the tidy pre/post CSV into a wide, paired frame.

    Returns a DataFrame indexed by participant_id with columns:
      pre_web, post_web, ... pre_total, post_total, (pre_confidence, post_confidence)
    Only participants with BOTH a pre and a post row are kept; others are
    reported and dropped, because learning gain requires a matched pair.
    """
    df = pd.read_csv(csv_path, comment="#")
    required = {"participant_id", "phase", "score_web", "score_container", "score_cloud"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV missing required columns: {sorted(missing)}\n\n{expected_schema()}")

    df["phase"] = df["phase"].str.lower().str.strip()
    if "score_total" not in df.columns:
        df["score_total"] = df[["score_web", "score_container", "score_cloud"]].sum(axis=1)

    has_conf = "confidence" in df.columns

    # pivot to wide: one row per participant, pre_* and post_* columns
    value_cols = ["score_web", "score_container", "score_cloud", "score_total"]
    if has_conf:
        value_cols.append("confidence")

    wide = df.pivot_table(index="participant_id", columns="phase", values=value_cols, aggfunc="first")
    wide.columns = [f"{phase}_{metric.replace('score_', '')}" for metric, phase in wide.columns]

    # keep only complete pairs
    complete = wide.dropna(subset=[c for c in wide.columns if c.startswith(("pre_", "post_"))])
    dropped = set(wide.index) - set(complete.index)
    if dropped:
        print(f"[WARN] Dropped {len(dropped)} participant(s) without a complete pre+post pair: "
              f"{sorted(dropped)}")
    print(f"[INFO] {len(complete)} participant(s) with complete pre/post pairs loaded.")
    return complete


def load_from_db_stub():
    """Placeholder for pulling directly from the MySQL `assessments` table.

    When you wire this up, the query is roughly:
        SELECT user_id AS participant_id,
               type    AS phase,           -- 'pre' | 'post'
               score_web, score_container, score_cloud,
               (score_web+score_container+score_cloud) AS score_total,
               -- confidence_ratings JSON -> summed to a 0..25 integer
        FROM assessments
        WHERE attempt_number = 1;          -- canonical first attempt only
    Then feed the resulting DataFrame into the same analysis functions.
    Anonymise: map user_id -> participant_code before analysis/export.

    NOTE: implemented for real in analysis/db_loader.py (see
    db_loader.fetch_real_tidy_frame() / load_wide_from_db()), which builds
    exactly the tidy frame described above, anonymises it, and hands it to
    load_scores() so it goes through the same tested validation/pairing path
    as the CSV workflow. This stub is left in place as the documented
    contract; it is intentionally not called from db_loader.py.
    """
    raise NotImplementedError("DB loader is a stub — see analysis/db_loader.py for the real implementation.")


# --------------------------------------------------------------------------- #
# Core metrics
# --------------------------------------------------------------------------- #
def normalised_gain(pre: np.ndarray, post: np.ndarray, max_score: float) -> np.ndarray:
    """Hake's per-participant normalised gain g = (post - pre) / (max - pre).

    Guards the degenerate case pre == max (no headroom): g is undefined there,
    returned as NaN and excluded from the mean, rather than dividing by zero.
    """
    pre = np.asarray(pre, float); post = np.asarray(post, float)
    headroom = max_score - pre
    with np.errstate(divide="ignore", invalid="ignore"):
        g = np.where(headroom > 0, (post - pre) / headroom, np.nan)
    return g


@dataclass
class DomainResult:
    name: str
    max_score: float
    n: int
    mean_pre: float
    sd_pre: float
    mean_post: float
    sd_post: float
    mean_raw_gain: float
    mean_norm_gain: float           # averaged normalised gain (excludes NaN)
    test_name: str
    statistic: float
    p_value: float
    significant: bool
    cohens_d: float
    normality_p: float

    def as_row(self) -> dict:
        return {
            "domain": self.name, "n": self.n,
            "mean_pre_%": round(100 * self.mean_pre / self.max_score, 1),
            "mean_post_%": round(100 * self.mean_post / self.max_score, 1),
            "raw_gain_pts": round(self.mean_raw_gain, 2),
            "norm_gain_g": round(self.mean_norm_gain, 3),
            "test": self.test_name,
            "p_value": round(self.p_value, 4),
            "significant": self.significant,
            "cohens_d": round(self.cohens_d, 2),
        }


def cohens_d_paired(pre: np.ndarray, post: np.ndarray) -> float:
    """Cohen's d for paired samples: mean difference / SD of differences."""
    diff = np.asarray(post, float) - np.asarray(pre, float)
    sd = diff.std(ddof=1)
    return float(diff.mean() / sd) if sd > 0 else 0.0


def analyse_domain(name: str, pre: np.ndarray, post: np.ndarray, max_score: float) -> DomainResult:
    """Run the full paired analysis for one score domain."""
    pre = np.asarray(pre, float); post = np.asarray(post, float)
    n = len(pre)
    diff = post - pre

    # choose the test: Shapiro-Wilk on the differences; if not normal (or tiny N),
    # use the non-parametric Wilcoxon signed-rank. With N<3 neither is meaningful.
    if n >= 3 and np.ptp(diff) > 0:
        norm_p = float(stats.shapiro(diff).pvalue)
    else:
        norm_p = float("nan")

    if np.all(diff == 0):
        test_name, stat, p = "none (no change)", 0.0, 1.0
    elif not np.isnan(norm_p) and norm_p >= ALPHA:
        res = stats.ttest_rel(post, pre)
        test_name, stat, p = "paired t-test", float(res.statistic), float(res.pvalue)
    else:
        # Wilcoxon requires non-zero differences; drop exact ties
        nz = diff[diff != 0]
        if len(nz) == 0:
            test_name, stat, p = "none (all ties)", 0.0, 1.0
        else:
            res = stats.wilcoxon(post, pre, zero_method="wilcox", correction=False)
            test_name, stat, p = "Wilcoxon signed-rank", float(res.statistic), float(res.pvalue)

    g = normalised_gain(pre, post, max_score)
    return DomainResult(
        name=name, max_score=max_score, n=n,
        mean_pre=float(pre.mean()), sd_pre=float(pre.std(ddof=1)),
        mean_post=float(post.mean()), sd_post=float(post.std(ddof=1)),
        mean_raw_gain=float(diff.mean()),
        mean_norm_gain=float(np.nanmean(g)),
        test_name=test_name, statistic=stat, p_value=p, significant=(p < ALPHA),
        cohens_d=cohens_d_paired(pre, post), normality_p=norm_p,
    )


def analyse(wide: pd.DataFrame) -> dict:
    """Full analysis across all domains + total (+ confidence if present)."""
    results = {}
    for dom, mx in DOMAIN_MAX.items():
        results[dom] = analyse_domain(dom, wide[f"pre_{dom}"], wide[f"post_{dom}"], mx)
    results["total"] = analyse_domain("total", wide["pre_total"], wide["post_total"], KNOWLEDGE_MAX)
    if "pre_confidence" in wide.columns:
        results["confidence"] = analyse_domain(
            "confidence", wide["pre_confidence"], wide["post_confidence"], CONFIDENCE_MAX)
    return results


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #
def interpret_g(g: float) -> str:
    """Hake's conventional bands for normalised gain."""
    if np.isnan(g): return "undefined"
    if g >= 0.7:  return "high gain"
    if g >= 0.3:  return "medium gain"
    if g > 0:     return "low gain"
    return "no/negative gain"


def interpret_d(d: float) -> str:
    ad = abs(d)
    if ad >= 0.8: return "large"
    if ad >= 0.5: return "medium"
    if ad >= 0.2: return "small"
    return "negligible"


def summary_table(results: dict) -> pd.DataFrame:
    return pd.DataFrame([r.as_row() for r in results.values()])


def narrative(results: dict, n: int) -> str:
    """A plain-English, honest summary suitable for pasting into the results chapter."""
    tot = results["total"]
    lines = []
    lines.append(f"Across {n} participants, the mean knowledge score rose from "
                 f"{100*tot.mean_pre/tot.max_score:.1f}% (pre) to "
                 f"{100*tot.mean_post/tot.max_score:.1f}% (post), a raw gain of "
                 f"{tot.mean_raw_gain:.2f} points.")
    lines.append(f"The mean normalised gain was g = {tot.mean_norm_gain:.3f} "
                 f"({interpret_g(tot.mean_norm_gain)}, on Hake's convention).")
    sig = "statistically significant" if tot.significant else "NOT statistically significant"
    lines.append(f"The pre-to-post difference was {sig} "
                 f"({tot.test_name}, p = {tot.p_value:.4f}, alpha = {ALPHA}), "
                 f"with a {interpret_d(tot.cohens_d)} effect size (Cohen's d = {tot.cohens_d:.2f}).")
    if n < 15:
        lines.append(f"NOTE: with only {n} participants the statistical power is limited; "
                     f"results should be read as indicative and reported with that caveat.")
    if "confidence" in results:
        c = results["confidence"]
        csig = "significant" if c.significant else "not significant"
        lines.append(f"Self-efficacy (confidence) rose by {c.mean_raw_gain:.2f} points "
                     f"(g = {c.mean_norm_gain:.3f}; {csig}, p = {c.p_value:.4f}).")
    return "\n".join(lines)
