"""
thematic_analysis.py
=====================
Thematic-analysis SUPPORT tool for the ChainBreak evaluation study (RQ2):
how experiencing a complete web -> container -> cloud attack chain affects
learners' understanding of real-world attack progression.

This tool does NOT perform thematic analysis. Braun & Clarke's (2006)
six-phase process — (1) familiarise with the data, (2) generate initial
codes, (3) search for themes, (4) review themes, (5) define and name
themes, (6) produce the report — is done ENTIRELY by the researcher,
reading the interview notes and assigning codes/themes by hand. This
script takes ONLY the researcher's own completed coding (one row per
participant/excerpt: participant_code, prompt, excerpt, code, theme — see
analysis/interview_coding_template.csv) and tabulates/visualises it:

  * a theme-frequency table (participants and excerpts per theme —
    "theme prevalence", the standard reporting unit in thematic analysis),
  * a code-to-theme summary (which codes roll up to which themes),
  * every excerpt filed under each theme, grouped for the researcher to
    pick representative quotes from for the write-up.

It never invents, infers, auto-generates, or uses an LLM to interpret a
code, a theme, or a quote. Every value in every output is a cell the
researcher typed into the coding CSV — this script only groups, counts,
and draws what is already there.

Usage:
    python thematic_analysis.py                       # analysis/data/interview_coding.csv
    python thematic_analysis.py interview_coding_template.csv   # run on the EXAMPLE rows

Real, anonymised interview coding lives in analysis/data/ (gitignored —
never committed). The template in the repo root of analysis/ holds only
illustrative EXAMPLE rows (participant_code starting "EXAMPLE-"), which
this script always treats and labels separately from real data — an
un-edited template can never be mistaken for a real result.
"""

from __future__ import annotations
import sys
from pathlib import Path

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ANALYSIS_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = ANALYSIS_DIR / "data" / "interview_coding.csv"
DEFAULT_OUTPUT_DIR = ANALYSIS_DIR / "data"
TEMPLATE_PATH = ANALYSIS_DIR / "interview_coding_template.csv"

REQUIRED_COLUMNS = ["participant_code", "prompt", "excerpt", "code", "theme"]

NAVY = "#1F3864"; BLUE = "#2E75B6"; GREEN = "#2E7D32"; GREY = "#5A5A5A"; AMBER = "#C0803A"
THEME_PALETTE = [BLUE, GREEN, AMBER, NAVY, "#8E44AD", "#C0392B", "#16A085"]


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #
def load_coding(csv_path) -> pd.DataFrame:
    """Reads the researcher's coded CSV exactly as written — no column is
    guessed, defaulted, or synthesised. Blank excerpt rows (a coding sheet
    mid-edit) are dropped rather than counted as data."""
    df = pd.read_csv(csv_path, comment="#")
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(
            f"Coding CSV missing required column(s): {missing}\n"
            f"Expected columns: {REQUIRED_COLUMNS} — see analysis/interview_coding_template.csv"
        )
    for col in REQUIRED_COLUMNS:
        df[col] = df[col].astype(str).str.strip()
    df = df[(df["excerpt"] != "") & (df["excerpt"].str.lower() != "nan")]
    return df.reset_index(drop=True)


def split_example_rows(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Separates the template's EXAMPLE rows (participant_code starting with
    'EXAMPLE') from real coded data. The two are never summarised together,
    so a not-yet-edited template can never be reported as a real result."""
    is_example = df["participant_code"].str.upper().str.startswith("EXAMPLE")
    return df[~is_example].copy(), df[is_example].copy()


# --------------------------------------------------------------------------- #
# Tabulation (no interpretation — grouping/counting only)
# --------------------------------------------------------------------------- #
def theme_frequency(df: pd.DataFrame) -> pd.DataFrame:
    """One row per theme: DISTINCT participants who raised it (prevalence —
    the standard thematic-analysis reporting unit) and how many coded
    excerpts support it."""
    if df.empty:
        return pd.DataFrame(columns=["theme", "participants", "excerpts", "codes"])
    grouped = df.groupby("theme").agg(
        participants=("participant_code", "nunique"),
        excerpts=("excerpt", "count"),
        codes=("code", lambda s: ", ".join(sorted(set(s)))),
    ).reset_index()
    return grouped.sort_values(["participants", "excerpts"], ascending=False).reset_index(drop=True)


def code_to_theme_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Which codes roll up to which themes, and how often/by whom each was used."""
    if df.empty:
        return pd.DataFrame(columns=["theme", "code", "excerpts", "participants"])
    grouped = df.groupby(["theme", "code"]).agg(
        excerpts=("excerpt", "count"),
        participants=("participant_code", "nunique"),
    ).reset_index()
    return grouped.sort_values(["theme", "excerpts"], ascending=[True, False]).reset_index(drop=True)


def quotes_by_theme(df: pd.DataFrame) -> pd.DataFrame:
    """Every excerpt, grouped by theme, for the researcher to pick
    representative quotes from — a listing, not a selection."""
    if df.empty:
        return pd.DataFrame(columns=["theme", "participant_code", "code", "prompt", "excerpt"])
    cols = ["theme", "participant_code", "code", "prompt", "excerpt"]
    return df[cols].sort_values(["theme", "participant_code"]).reset_index(drop=True)


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #
def print_report(freq: pd.DataFrame, code_summary: pd.DataFrame, quotes: pd.DataFrame, n_participants: int):
    print("\n--- Theme prevalence (participants / excerpts) ---")
    print(freq.to_string(index=False) if not freq.empty else "(no themes coded)")

    print("\n--- Codes under each theme ---")
    print(code_summary.to_string(index=False) if not code_summary.empty else "(no codes assigned)")

    print("\n--- Excerpts by theme (for selecting representative quotes) ---")
    if quotes.empty:
        print("(no excerpts coded)")
    else:
        for theme, rows in quotes.groupby("theme"):
            print(f"\n[{theme}]")
            for _, row in rows.iterrows():
                print(f"  {row['participant_code']} ({row['code']}): \"{row['excerpt']}\"")

    print(f"\n[INFO] {n_participants} participant(s) represented across {len(freq)} theme(s).")


# --------------------------------------------------------------------------- #
# Figures
# --------------------------------------------------------------------------- #
def make_figures(freq: pd.DataFrame, code_summary: pd.DataFrame, output_dir: Path, prefix: str = ""):
    if freq.empty:
        print("[INFO] No themes to plot — skipping figures.")
        return

    # --- Fig 1: theme prevalence, horizontal bar chart ---
    ordered = freq.sort_values("participants")
    fig, ax = plt.subplots(figsize=(9, max(3, 0.7 * len(ordered) + 1.2)))
    bars = ax.barh(ordered["theme"], ordered["participants"], color=BLUE)
    max_p = ordered["participants"].max()
    for bar, excerpts in zip(bars, ordered["excerpts"]):
        ax.text(bar.get_width() + max_p * 0.03, bar.get_y() + bar.get_height() / 2,
                f"{int(bar.get_width())} participant(s) · {excerpts} excerpt(s)",
                va="center", fontsize=8, color=GREY)
    ax.set_xlabel("Participants who raised this theme")
    ax.set_title("RQ2 — theme prevalence", color=NAVY)
    ax.set_xlim(0, max_p * 1.6)
    [ax.spines[s].set_visible(False) for s in ("top", "right")]
    plt.tight_layout()
    plt.savefig(output_dir / f"{prefix}fig_theme_prevalence.png", dpi=200)
    plt.close()

    # --- Fig 2: thematic map — each theme's box, with its codes listed beside it ---
    themes = list(freq["theme"])
    # Height derived from the EXACT same per-theme step the drawing loop below
    # uses (block_height + 0.6 gap) — computing it any other way risks the two
    # disagreeing and clipping the last theme off the bottom of the figure.
    block_heights = [0.7 * max(1, len(code_summary[code_summary.theme == t])) for t in themes]
    fig_height = max(4, sum(h + 0.6 for h in block_heights) + 0.6)
    fig, ax = plt.subplots(figsize=(9, fig_height))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, fig_height)
    ax.axis("off")
    ax.set_title("RQ2 — thematic map (codes grouped under themes)", color=NAVY, fontsize=12)

    y = fig_height - 0.6
    for i, theme in enumerate(themes):
        color = THEME_PALETTE[i % len(THEME_PALETTE)]
        codes = code_summary[code_summary.theme == theme]
        block_height = block_heights[i]
        theme_y = y - block_height / 2 + 0.35
        ax.add_patch(plt.Rectangle((0.3, theme_y - 0.35), 3.2, 0.7, facecolor=color, edgecolor="none"))
        ax.text(1.9, theme_y, theme, ha="center", va="center", color="white",
                fontsize=8, fontweight="bold", wrap=True)

        code_y = y
        for _, row in codes.iterrows():
            ax.plot([3.5, 4.1], [theme_y, code_y], color=color, lw=1)
            ax.add_patch(plt.Rectangle((4.1, code_y - 0.28), 5.4, 0.56, facecolor="#F2F2F2", edgecolor=color, lw=1))
            ax.text(4.3, code_y, f"{row['code']}  ·  {row['excerpts']} excerpt(s), {row['participants']} participant(s)",
                    ha="left", va="center", color=NAVY, fontsize=7.5)
            code_y -= 0.7
        y -= block_height + 0.6

    plt.tight_layout()
    plt.savefig(output_dir / f"{prefix}fig_thematic_map.png", dpi=200)
    plt.close()

    print(f"[INFO] figures written: {prefix}fig_theme_prevalence.png, {prefix}fig_thematic_map.png")


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def main():
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT

    print("=" * 70)
    print("ChainBreak — RQ2 Thematic Analysis (researcher-coded data only)")
    print("=" * 70)

    if not input_path.exists():
        print(f"\n[INFO] No coded data found at {input_path}.")
        print("[INFO] This is expected before interview coding has started — not an error.")
        print(f"[INFO] Copy {TEMPLATE_PATH.name} to {DEFAULT_INPUT}, delete the EXAMPLE rows, and")
        print("       fill it in with your own coding of the real (anonymised) interview notes.")
        print(f"[INFO] To see what the tool produces first, run it against the template directly:")
        print(f"       python thematic_analysis.py {TEMPLATE_PATH.name}")
        return

    df = load_coding(input_path)
    real, example = split_example_rows(df)

    if real.empty and example.empty:
        print(f"\n[INFO] {input_path} has no coded rows yet. Nothing to summarise.")
        return

    if real.empty:
        print(f"\n[INFO] {input_path} currently contains only the {len(example)} EXAMPLE row(s) from "
              f"the template — no real coding yet. Showing what those EXAMPLE rows produce so you can "
              f"see the expected output shape.")
        print("[INFO] >>> THIS IS EXAMPLE DATA — NOT A REAL RESULT. <<<")
        working, prefix, label = example, "_EXAMPLE_", "EXAMPLE DATA — NOT REAL RESULTS"
    else:
        if not example.empty:
            print(f"\n[WARN] Ignoring {len(example)} leftover EXAMPLE row(s) still in {input_path} — "
                  f"delete them from the file. They are excluded from this summary.")
        working, prefix, label = real, "", ""

    if label:
        print(f"\n[{label}]")

    freq = theme_frequency(working)
    code_summary = code_to_theme_summary(working)
    quotes = quotes_by_theme(working)
    n_participants = working["participant_code"].nunique()

    print_report(freq, code_summary, quotes, n_participants)

    DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    summary_path = DEFAULT_OUTPUT_DIR / f"{prefix}rq2_theme_summary.csv"
    freq.to_csv(summary_path, index=False)
    print(f"\n[INFO] {summary_path} written.")

    codes_path = DEFAULT_OUTPUT_DIR / f"{prefix}rq2_code_to_theme.csv"
    code_summary.to_csv(codes_path, index=False)
    print(f"[INFO] {codes_path} written.")

    quotes_path = DEFAULT_OUTPUT_DIR / f"{prefix}rq2_quotes_by_theme.csv"
    quotes.to_csv(quotes_path, index=False)
    print(f"[INFO] {quotes_path} written.")

    make_figures(freq, code_summary, DEFAULT_OUTPUT_DIR, prefix=prefix)
    print("\nDone.")


if __name__ == "__main__":
    main()
