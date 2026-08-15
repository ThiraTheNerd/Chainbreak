from __future__ import annotations
from pathlib import Path

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy import stats

import hint_loader
import db_loader

ANALYSIS_DIR = Path(__file__).resolve().parent
EXPORT_DIR = ANALYSIS_DIR / "exports"

NAVY = "#1F3864"; BLUE = "#2E75B6"; GREEN = "#2E7D32"; GREY = "#5A5A5A"; AMBER = "#C0803A"

TIER_BUCKET_ORDER = ["Tier 1 only", "Up to Tier 2", "Up to Tier 3"]


def depth_bucket(max_tier: int) -> str:
    """Buckets a participant's DEEPEST hint tier reached. Hints are revealed
    progressively (server/services/hint.service.js enforces order), so
    "max tier reached" already implies every lower tier was also used."""
    if max_tier <= 1:
        return "Tier 1 only"
    if max_tier == 2:
        return "Up to Tier 2"
    return "Up to Tier 3"


# --------------------------------------------------------------------------- #
# Behavioural description (no interpretation — grouping/counting only)
# --------------------------------------------------------------------------- #
def summarise_behaviour(hints: pd.DataFrame, total_participants: int) -> dict:
    per_participant = hints.groupby("participant_id").agg(
        total_hints=("tier", "count"),
        max_tier=("tier", "max"),
        xp_spent=("cost", "sum"),
        ai_hints=("source", lambda s: int((s == "ai").sum())),
        fallback_hints=("source", lambda s: int((s == "fallback").sum())),
    ).reset_index().sort_values("total_hints", ascending=False).reset_index(drop=True)

    n_used = per_participant["participant_id"].nunique()
    uptake = {
        "used": n_used,
        "total_participants": total_participants,
        "pct": (100 * n_used / total_participants) if total_participants else None,
    }

    bucket_counts = per_participant["max_tier"].map(depth_bucket).value_counts()
    never_used = max(0, total_participants - n_used)
    depth_rows = [{"bucket": "No hints used", "participants": never_used}]
    for bucket in TIER_BUCKET_ORDER:
        depth_rows.append({"bucket": bucket, "participants": int(bucket_counts.get(bucket, 0))})
    depth_distribution = pd.DataFrame(depth_rows)

    depth_by_layer_rows = []
    for layer, layer_hints in hints.groupby("layer"):
        layer_max_tier = layer_hints.groupby("participant_id")["tier"].max()
        layer_bucket_counts = layer_max_tier.map(depth_bucket).value_counts()
        for bucket in TIER_BUCKET_ORDER:
            depth_by_layer_rows.append({
                "layer": layer, "bucket": bucket,
                "participants": int(layer_bucket_counts.get(bucket, 0)),
            })
    depth_by_layer = pd.DataFrame(depth_by_layer_rows)

    source_counts = hints["source"].value_counts()
    total_events = len(hints)
    source_breakdown = pd.DataFrame({
        "source": source_counts.index,
        "count": source_counts.values,
        "pct": [round(100 * c / total_events, 1) for c in source_counts.values],
    })

    return {
        "per_participant": per_participant,
        "uptake": uptake,
        "depth_distribution": depth_distribution,
        "depth_by_layer": depth_by_layer,
        "source_breakdown": source_breakdown,
    }


def print_behavioural_report(b: dict):
    u = b["uptake"]
    pct = f"{u['pct']:.1f}%" if u["pct"] is not None else "n/a"
    print("\n--- Hint uptake ---")
    print(f"{u['used']} of {u['total_participants']} participant(s) used at least one hint ({pct}).")

    print("\n--- Usage depth (deepest tier reached) ---")
    print(b["depth_distribution"].to_string(index=False))

    if not b["depth_by_layer"].empty:
        print("\n--- Usage depth by layer ---")
        print(b["depth_by_layer"].to_string(index=False))

    print("\n--- AI vs fallback source ---")
    print(b["source_breakdown"].to_string(index=False))

    print("\n--- Per-participant hint usage ---")
    print(b["per_participant"].to_string(index=False))


def make_behavioural_figures(b: dict, output_dir: Path):
    # --- Fig 1: usage depth ---
    dist = b["depth_distribution"]
    colors = [GREY, BLUE, "#5DA9E9", NAVY][:len(dist)]
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.bar(dist["bucket"], dist["participants"], color=colors)
    ax.set_ylabel("Participants")
    ax.set_title("RQ3 — hint usage depth (deepest tier reached)", color=NAVY)
    [ax.spines[s].set_visible(False) for s in ("top", "right")]
    plt.tight_layout()
    plt.savefig(output_dir / "fig_hint_depth.png", dpi=200)
    plt.close()

    # --- Fig 2: AI vs fallback source ---
    src = b["source_breakdown"]
    color_map = {"ai": BLUE, "fallback": AMBER}
    fig, ax = plt.subplots(figsize=(5, 4.5))
    ax.bar(src["source"].str.upper(), src["count"], color=[color_map.get(s, GREY) for s in src["source"]])
    for i, (count, pct) in enumerate(zip(src["count"], src["pct"])):
        ax.text(i, count, f"{count} ({pct}%)", ha="center", va="bottom", fontsize=9, color=GREY)
    ax.set_ylabel("Hints revealed")
    ax.set_title("RQ3 — AI vs fallback hint source", color=NAVY)
    [ax.spines[s].set_visible(False) for s in ("top", "right")]
    plt.tight_layout()
    plt.savefig(output_dir / "fig_hint_source.png", dpi=200)
    plt.close()

    print(f"\n[INFO] figures written: fig_hint_depth.png, fig_hint_source.png (in {output_dir})")


# --------------------------------------------------------------------------- #
# Descriptive (NOT causal) association with RQ1 learning gain
# --------------------------------------------------------------------------- #
def describe_hint_vs_gain(per_participant: pd.DataFrame, wide: pd.DataFrame) -> dict:
    """Joins per-participant hint usage to their RQ1 total learning gain
    (post_total - pre_total, from the SAME paired wide frame RQ1's own
    analysis uses — no scoring reimplemented here). Only participants
    present in BOTH datasets can be compared.

    A correlation coefficient is only computed at N >= 3 — below that a
    number is not just weak, it's not meaningful at all (Pearson r on 2
    points is trivially +-1). Whatever N is, this is a DESCRIPTIVE
    association: it says nothing about whether hints caused the gain
    (or lack of it) a participant showed.
    """
    gain = (wide["post_total"] - wide["pre_total"]).rename("learning_gain")
    merged = per_participant.set_index("participant_id").join(gain, how="inner").reset_index()

    result = {"merged": merged, "pearson_r": None, "pearson_p": None, "spearman_r": None, "spearman_p": None}
    if len(merged) >= 3:
        pear = stats.pearsonr(merged["total_hints"], merged["learning_gain"])
        spear = stats.spearmanr(merged["total_hints"], merged["learning_gain"])
        result["pearson_r"], result["pearson_p"] = float(pear.statistic), float(pear.pvalue)
        result["spearman_r"], result["spearman_p"] = float(spear.statistic), float(spear.pvalue)
    return result


def print_association_report(assoc: dict):
    merged = assoc["merged"]
    print("\n" + "=" * 70)
    print("DESCRIPTIVE ASSOCIATION ONLY — NOT A CAUSAL CLAIM")
    print(f"No hint/no-hint control group; small sample (N = {len(merged)} with both hint and "
          f"gain data). A relationship (or lack of one) below describes THIS sample only — it")
    print("cannot show that hints caused, helped, or hurt learning.")
    print("=" * 70)

    if merged.empty:
        print("\n[INFO] No participant has both hint-usage data and a complete real pre+post pair yet.")
        return

    print(f"\n--- Per-participant hint usage vs total learning gain (N={len(merged)}) ---")
    print(merged[["participant_id", "total_hints", "max_tier", "xp_spent", "learning_gain"]]
          .to_string(index=False))

    if assoc["pearson_r"] is None:
        print(f"\n[INFO] Only {len(merged)} participant(s) have both hint and gain data — too few "
              f"to compute even a descriptive correlation coefficient meaningfully. The raw "
              f"per-participant pairs above are shown instead of a coefficient.")
    else:
        print(f"\nPearson r = {assoc['pearson_r']:.3f} (p = {assoc['pearson_p']:.3f}); "
              f"Spearman rho = {assoc['spearman_r']:.3f} (p = {assoc['spearman_p']:.3f})")
        print("Reported as a DESCRIPTIVE association only (see caveat above) — do not interpret "
              "this as evidence that hints improved or harmed learning, and note the sample is "
              "underpowered for any such claim regardless of the coefficient's size.")


def make_association_figure(assoc: dict, output_dir: Path):
    merged = assoc["merged"]
    if merged.empty:
        print("[INFO] No overlapping hint/gain data — skipping the association figure.")
        return

    fig, ax = plt.subplots(figsize=(7, 5.5))
    ax.scatter(merged["total_hints"], merged["learning_gain"], color=BLUE, s=70, zorder=3)
    for _, row in merged.iterrows():
        ax.annotate(row["participant_id"], (row["total_hints"], row["learning_gain"]),
                    textcoords="offset points", xytext=(6, 4), fontsize=8, color=GREY)
    ax.axhline(0, color="#CCCCCC", lw=0.8, zorder=1)
    ax.set_xlabel("Total hints used")
    ax.set_ylabel("Total learning gain (post - pre knowledge score)")
    ax.set_title(
        f"RQ3 — hint usage vs learning gain (N={len(merged)})\n"
        "Descriptive / exploratory only — NOT a causal relationship (no control group, small N)",
        color=NAVY, fontsize=10,
    )
    [ax.spines[s].set_visible(False) for s in ("top", "right")]
    plt.tight_layout()
    plt.savefig(output_dir / "fig_hint_vs_gain.png", dpi=200)
    plt.close()
    print(f"[INFO] figure written: fig_hint_vs_gain.png (in {output_dir})")


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def main():
    print("=" * 70)
    print("ChainBreak — RQ3 Hint-Usage Analysis (descriptive / exploratory)")
    print("=" * 70)
    print("This study has NO hint/no-hint control group and a small sample. Everything")
    print("below describes usage and, at most, an association with learning gain —")
    print("nothing here is, or should be read as, a causal claim.")

    hints = hint_loader.fetch_real_hint_frame()
    if hints.empty:
        print("\n[INFO] No hint usage recorded yet (hint_unlocks is empty).")
        print("[INFO] This is expected if no learner has revealed a hint yet — not an error.")
        return

    total_participants = hint_loader.fetch_total_participant_count()
    behaviour = summarise_behaviour(hints, total_participants)
    print_behavioural_report(behaviour)

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    behaviour["per_participant"].to_csv(EXPORT_DIR / "rq3_hint_summary.csv", index=False)
    behaviour["depth_distribution"].to_csv(EXPORT_DIR / "rq3_hint_depth_distribution.csv", index=False)
    behaviour["source_breakdown"].to_csv(EXPORT_DIR / "rq3_hint_source_breakdown.csv", index=False)
    print(f"\n[INFO] rq3_hint_summary.csv, rq3_hint_depth_distribution.csv, "
          f"rq3_hint_source_breakdown.csv written to {EXPORT_DIR}")

    make_behavioural_figures(behaviour, EXPORT_DIR)

    print("\n" + "-" * 70)
    print("Relating hint usage to RQ1 learning gain (reusing db_loader/learning_gain —")
    print("no scoring reimplemented here)...")
    wide, n_considered = db_loader.load_wide_from_db(export_csv=False)
    if wide is None:
        print(f"\n[INFO] Fewer than 2 participants currently have a complete real pre+post pair "
              f"({n_considered} considered) — see analysis/README.md's RQ1 section. Cannot yet "
              f"describe a hint-usage-vs-learning-gain relationship. This is expected before the "
              f"study has post-session assessment data, not an error.")
        return

    assoc = describe_hint_vs_gain(behaviour["per_participant"], wide)
    print_association_report(assoc)
    if not assoc["merged"].empty:
        assoc["merged"].to_csv(EXPORT_DIR / "rq3_hint_vs_gain.csv", index=False)
        print(f"[INFO] rq3_hint_vs_gain.csv written to {EXPORT_DIR}")
    make_association_figure(assoc, EXPORT_DIR)

    print("\nDone.")


if __name__ == "__main__":
    main()
