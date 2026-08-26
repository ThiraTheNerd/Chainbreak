"""
run_analysis.py — end-to-end learning-gain analysis + figures.

Usage:
    python run_analysis.py <path_to_scores.csv>
    python run_analysis.py --from-db

Produces, alongside the CSV:
    - console report (descriptives, normalised gain, significance, effect size)
    - results_summary.csv  (the per-domain table, ready for the dissertation)
    - fig_prepost.png      (mean pre vs post by domain, with error bars)
    - fig_gain_hist.png    (distribution of per-participant normalised gain)
    - fig_participant_gain.png (per-participant raw gain, sorted)

Run it on REAL exported data. The numbers it prints are exactly what your data
shows — favourable or not.

--from-db loads REAL data from the ChainBreak MySQL `assessments` table via
db_loader.py (anonymised before it ever reaches this script — see
analysis/README.md). If fewer than 2 participants have a complete real
pre+post pair yet, it says so and exits WITHOUT writing results_summary.csv
or any figures, rather than silently substituting synthetic data — a real
run must never be confused with a pipeline test. To exercise the pipeline
before real data exists, run make_synthetic_data.py and pass one of its
_SYNTHETIC_*.csv files explicitly instead.
"""

import argparse
import sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import learning_gain as lg

NAVY = "#1F3864"; BLUE = "#2E75B6"; GREEN = "#2E7D32"; GREY = "#5A5A5A"; AMBER = "#C0803A"


def make_figures(wide: pd.DataFrame, results: dict, prefix: str = ""):
    # --- Fig 1: mean pre vs post by domain (as %) ---
    doms = ["web", "container", "cloud", "total"]
    pre_pct = [100 * results[d].mean_pre / results[d].max_score for d in doms]
    post_pct = [100 * results[d].mean_post / results[d].max_score for d in doms]
    pre_sd = [100 * results[d].sd_pre / results[d].max_score for d in doms]
    post_sd = [100 * results[d].sd_post / results[d].max_score for d in doms]
    x = np.arange(len(doms)); w = 0.38
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(x - w/2, pre_pct, w, yerr=pre_sd, capsize=4, label="Pre", color=GREY)
    ax.bar(x + w/2, post_pct, w, yerr=post_sd, capsize=4, label="Post", color=GREEN)
    ax.set_xticks(x); ax.set_xticklabels([d.capitalize() for d in doms])
    ax.set_ylabel("Mean score (%)"); ax.set_ylim(0, 100)
    ax.set_title("Pre vs Post knowledge score by domain", color=NAVY)
    ax.legend(); [ax.spines[s].set_visible(False) for s in ("top", "right")]
    plt.tight_layout(); plt.savefig(f"{prefix}fig_prepost.png", dpi=200); plt.close()

    # --- Fig 2: distribution of normalised gain (total) ---
    g = lg.normalised_gain(wide["pre_total"], wide["post_total"], lg.KNOWLEDGE_MAX)
    g = g[~np.isnan(g)]
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.hist(g, bins=8, color=BLUE, edgecolor="white")
    ax.axvline(np.mean(g), color=NAVY, ls="--", lw=2, label=f"mean g = {np.mean(g):.2f}")
    for b, c in [(0.3, "#888"), (0.7, "#888")]:
        ax.axvline(b, color=c, ls=":", lw=1)
    ax.set_xlabel("Normalised gain  g = (post-pre)/(max-pre)")
    ax.set_ylabel("Participants")
    ax.set_title("Distribution of per-participant normalised gain", color=NAVY)
    ax.legend(); [ax.spines[s].set_visible(False) for s in ("top", "right")]
    plt.tight_layout(); plt.savefig(f"{prefix}fig_gain_hist.png", dpi=200); plt.close()

    # --- Fig 3: per-participant raw gain, sorted ---
    raw = (wide["post_total"] - wide["pre_total"]).sort_values()
    fig, ax = plt.subplots(figsize=(8, 5))
    colors = [GREEN if v > 0 else (GREY if v == 0 else AMBER) for v in raw.values]
    ax.bar(range(len(raw)), raw.values, color=colors)
    ax.axhline(0, color="black", lw=0.8)
    ax.set_xticks(range(len(raw))); ax.set_xticklabels(raw.index, rotation=90, fontsize=7)
    ax.set_ylabel("Raw gain (points, /33)")
    ax.set_title("Per-participant learning gain (sorted)", color=NAVY)
    [ax.spines[s].set_visible(False) for s in ("top", "right")]
    plt.tight_layout(); plt.savefig(f"{prefix}fig_participant_gain.png", dpi=200); plt.close()

    print(f"[INFO] figures written: {prefix}fig_prepost.png, {prefix}fig_gain_hist.png, "
          f"{prefix}fig_participant_gain.png")


def main(wide: pd.DataFrame, source_label: str = "", output_prefix: str = ""):
    print("=" * 70)
    title = "ChainBreak — Learning-Gain Analysis"
    if source_label:
        title += f"  [{source_label}]"
    print(title)
    print("=" * 70)
    n = len(wide)
    if n < 2:
        print("[ERROR] Need at least 2 complete pairs to analyse."); return

    results = lg.analyse(wide)

    print("\n--- Per-domain summary ---")
    table = lg.summary_table(results)
    print(table.to_string(index=False))
    summary_path = f"{output_prefix}results_summary.csv"
    table.to_csv(summary_path, index=False)
    print(f"\n[INFO] {summary_path} written.")

    print("\n--- Narrative (honest, paste-ready) ---")
    print(lg.narrative(results, n))

    make_figures(wide, results, prefix=output_prefix)
    print("\nDone.")


def _parse_args():
    parser = argparse.ArgumentParser(
        description="ChainBreak learning-gain analysis: run on a tidy CSV, or --from-db for real data.")
    parser.add_argument("csv_path", nargs="?",
                         help="Path to a tidy pre/post CSV (see learning_gain.expected_schema())")
    parser.add_argument("--from-db", action="store_true",
                         help="Load REAL data from the ChainBreak MySQL `assessments` table "
                              "(see analysis/db_loader.py). Never falls back to synthetic data.")
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    if args.from_db and args.csv_path:
        print("[ERROR] Pass either a CSV path or --from-db, not both.")
        sys.exit(1)

    if args.from_db:
        import db_loader
        wide, n_considered = db_loader.load_wide_from_db()
        if wide is None:
            print(f"[INFO] {n_considered} participant(s) with a canonical (attempt_number = 1) "
                  f"submission found in the database, but fewer than 2 have BOTH a pre and a "
                  f"post attempt yet.")
            print("[INFO] No real learning-gain result can be reported yet — this is expected "
                  "before the study has post-session data, not an error. No results_summary.csv "
                  "or figures were written.")
            print("[INFO] To exercise the pipeline meanwhile (NOT real results):")
            print("       python make_synthetic_data.py")
            print("       python run_analysis.py _SYNTHETIC_realistic_DO_NOT_USE_AS_RESULTS.csv")
            sys.exit(0)
        main(wide, source_label=f"REAL DATA — {n_considered} participant(s) considered")
    elif args.csv_path:
        wide = lg.load_scores(args.csv_path)
        is_synthetic = "SYNTHETIC" in args.csv_path.upper()
        label = "SYNTHETIC TEST DATA — NOT REAL RESULTS" if is_synthetic else ""
        # Prefix output filenames too when the input is synthetic — the console
        # banner disappears once the terminal scrolls, but a bare
        # results_summary.csv/fig_*.png left on disk would look exactly like a
        # real run's output days later.
        prefix = "_SYNTHETIC_" if is_synthetic else ""
        main(wide, source_label=label, output_prefix=prefix)
    else:
        print("Usage: python run_analysis.py <scores.csv>   OR   python run_analysis.py --from-db")
        print("\n" + lg.expected_schema())
        sys.exit(1)
