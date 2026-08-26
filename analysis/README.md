# ChainBreak evaluation analysis

Three tools for the ChainBreak evaluation study: a quantitative
learning-gain pipeline (RQ1), a thematic-analysis support tool for
interview data (RQ2), and a hint-usage analysis (RQ3). RQ1 and RQ2 share no
code and can be used independently; RQ3 reuses RQ1's DB connection/
anonymisation (`db_loader.py`) and RQ1's own learning-gain pairing to relate
hint usage to gain — see **RQ3** below.

## RQ1 — learning gain

Computes pre/post learning gain: Hake's normalised gain, a paired
significance test (t-test or Wilcoxon, chosen automatically from a
normality check), Cohen's d effect size, a per-domain (web/container/cloud)
breakdown, and figures.

The statistics live in `learning_gain.py` and are unchanged from the tested
version — this directory only adds real-data plumbing around them.

## Files

| File | What it is |
|---|---|
| `learning_gain.py` | RQ1 core stats: descriptives, Hake's g, paired test selection, Cohen's d, narrative. |
| `run_analysis.py` | RQ1 runner + figures. `python run_analysis.py <csv>` or `python run_analysis.py --from-db`. |
| `db_loader.py` | Reads REAL data from the ChainBreak MySQL `assessments` table, anonymises it, and feeds it through `learning_gain.load_scores()`. |
| `make_synthetic_data.py` | ⚠️ Generates **fake** data for testing the RQ1 pipeline only. Never real results. |
| `thematic_analysis.py` | RQ2 — tabulates/visualises the researcher's own thematic coding. See **RQ2** below. |
| `interview_coding_template.csv` | RQ2 coding-sheet template with illustrative EXAMPLE rows only. |
| `hint_loader.py` | RQ3 — reads REAL `hint_unlocks` telemetry, anonymised via `db_loader`'s shared mapping. |
| `hint_analysis.py` | RQ3 — hint-usage description + descriptive (non-causal) association with RQ1 gain. See **RQ3** below. |
| `requirements.txt` | Python dependencies (shared by all three tools). |
| `.gitignore` | Keeps real/sensitive outputs and the anonymisation key out of git. |

## Setup

```bash
cd analysis
python3 -m venv .venv && source .venv/bin/activate   # optional but recommended
pip install -r requirements.txt
```

`db_loader.py` reads DB credentials from **`server/.env`** — the exact same
file the Node backend uses (`server/config/env.js`): `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASS`, `DB_NAME`. Nothing is duplicated or hardcoded here; if
that file is missing the required vars, `db_loader.py` raises a clear error
naming which ones.

## Running on real data

```bash
python run_analysis.py --from-db
```

This queries the `assessments` table for **canonical first attempts only**
(`attempt_number = 1`) — matching how `server/routes/assessment.js`'s
`GET /mine` treats resubmissions: the first attempt of each type is what
pre/post analysis uses, never a later resubmission. It then:

1. Maps each `user_id` to a stable participant code (`P01`, `P02`, ...) —
   see **Anonymisation** below. This happens *before* anything is written to
   disk or returned to the analysis functions.
2. Builds the same tidy shape `learning_gain.load_scores()` expects from a
   CSV, and hands it to that exact same function — so real data is
   validated, paired, and reported through the identical, already-tested
   code path the CSV workflow uses. No statistics are reimplemented in the
   loader.
3. Writes the anonymised export to `analysis/exports/real_data_export.csv`
   (gitignored — see **Data integrity** below), then prints the report and
   writes `results_summary.csv` and the three figures.

Participants missing a pre or a post attempt are reported and excluded —
`learning_gain.load_scores()` already does this and it is unchanged.

If fewer than 2 participants currently have a **complete** real pre+post
pair, `--from-db` says so plainly and exits without writing any output
files — it does **not** silently fall back to synthetic data. (As of this
integration, the database has 2 real `pre` submissions and 0 `post`
submissions, so `--from-db` will currently report exactly that.)

## Testing the pipeline before real data exists

```bash
python make_synthetic_data.py
python run_analysis.py _SYNTHETIC_realistic_DO_NOT_USE_AS_RESULTS.csv
python run_analysis.py _SYNTHETIC_null_DO_NOT_USE_AS_RESULTS.csv
```

**⚠️ `make_synthetic_data.py`'s output is fake data for exercising the code
path only. It must never be reported, quoted, or mistaken for real study
results — that's why every file it writes is prefixed `_SYNTHETIC_` and
carries a header comment saying so, and why `run_analysis.py` prints
`[SYNTHETIC TEST DATA — NOT REAL RESULTS]` in its banner whenever the input
path contains `SYNTHETIC`.**

## Real data schema

From `server/db/schema.sql`, the `assessments` table:

```
user_id, type ('pre'|'post'), answers JSON,
score_web (0-10), score_container (0-13), score_cloud (0-10),
attempt_number, confidence_ratings JSON, sus_responses JSON, sus_score,
submitted_at
```

The 33-item knowledge test splits 10 web / 13 container / 10 cloud
(`server/routes/assessment.js`, `ANSWER_KEY`) — `learning_gain.py`'s
`KNOWLEDGE_MAX`/`DOMAIN_MAX` already match this exactly, so nothing needed
correcting there. Confidence is 5 self-efficacy items on a 1-5 Likert scale
(`CONFIDENCE_ITEM_IDS`), matching `CONFIDENCE_MAX = 25`.

### Confidence total (0..25)

`server/routes/assessment.js` validates `confidence_ratings` as an array of
exactly 5 `{itemId, rating}` objects (ratings 1-5) and stores it **verbatim**
— unlike SUS, it never reduces confidence to a single number server-side
(there is no `computeConfidenceScore`, and no reverse-scoring of any item).
So `db_loader._confidence_total()` does the only thing consistent with that:
sums the 5 stored ratings, giving a 5–25 total (5 items × 1–5).

## Anonymisation

`db_loader.fetch_real_tidy_frame()` maps each real `user_id` to a stable
participant code (`P01`, `P02`, ...) **before** any DataFrame is returned,
exported, or analysed. The mapping is persisted in
**`analysis/participant_map.json`** so the same participant keeps the same
code across repeated runs (needed to track someone across pre/post without
ever re-deriving the mapping from scratch). That file is the *only* place a
real `user_id` and a participant code are ever linked, and it is listed in
`analysis/.gitignore` — **never commit it**.

## Data integrity

- The pipeline reports whatever the real data shows — including a null,
  weak, or negative result. Nothing is generated, altered, imputed, or
  fabricated for real participants.
- The only synthetic data anywhere in this directory is
  `make_synthetic_data.py`'s clearly-labelled `_SYNTHETIC_*.csv` output,
  which exists solely to prove the statistics run correctly on messy,
  imperfect data.
- Anonymisation happens before any output file (export CSV, results
  summary, figures) is written — never after.
- `analysis/.gitignore` keeps `participant_map.json`, the real-data export,
  `results_summary.csv`, figures, and the synthetic CSVs out of git, since
  they're either a re-identification key or research data / regeneratable
  test output, not source code.

## Do not

- Do not edit `learning_gain.py`'s statistics (Hake's g, test selection,
  Cohen's d, narrative) as part of "integration" work — that logic is
  tested and out of scope here.
- Do not treat any `_SYNTHETIC_*` file, or a run of `run_analysis.py`
  against one, as a real result.

---

## RQ2 — thematic analysis (interview data)

`thematic_analysis.py` is a **support tool**, not an analysis tool: it does
not perform thematic analysis and never will. Braun & Clarke's (2006)
six-phase process is entirely manual, done by the researcher:

1. **Familiarise** — read/re-read the interview notes.
2. **Generate initial codes** — label excerpts with short codes, by hand.
3. **Search for themes** — group related codes into candidate themes.
4. **Review themes** — check themes against the coded excerpts and the
   whole data set.
5. **Define and name themes** — settle each theme's scope and name.
6. **Produce the report** — write up, drawing on representative quotes.

`thematic_analysis.py` picks up at the *output* of phases 2-5: once the
researcher has a CSV of `participant_code, prompt, excerpt, code, theme`
rows (see `interview_coding_template.csv`), it tabulates and visualises
that coding — a theme-frequency table (participants and excerpts per
theme, the standard prevalence unit in thematic analysis reporting), a
code-to-theme summary, and every excerpt grouped by theme so the researcher
can pick representative quotes for phase 6. **It never generates, infers,
or uses an LLM to suggest a code, a theme, or a quote** — every value in
every output traces back to a cell the researcher typed in by hand.

### Workflow

```bash
cd analysis
cp interview_coding_template.csv data/interview_coding.csv   # analysis/data/ is gitignored
```

Delete the 4 `EXAMPLE-P0x` rows from `data/interview_coding.csv` and
replace them with your own coding of the real (anonymised, written-notes)
interview excerpts — one row per excerpt. A theme can (and usually will)
have several codes and several excerpts under it; a participant can appear
under several themes.

```bash
python thematic_analysis.py                       # analysis/data/interview_coding.csv
```

This prints the theme-frequency table, the code-to-theme summary, and every
excerpt grouped by theme to the console, then writes to `analysis/data/`
(gitignored):

- `rq2_theme_summary.csv` — theme, participant count, excerpt count, codes.
- `rq2_code_to_theme.csv` — one row per (theme, code) pair.
- `rq2_quotes_by_theme.csv` — every excerpt, grouped by theme, for picking
  quotes for the write-up.
- `fig_theme_prevalence.png` — horizontal bar chart of participants per theme.
- `fig_thematic_map.png` — each theme with its codes listed alongside it.

### Seeing the expected shape before you have real coding

```bash
python thematic_analysis.py interview_coding_template.csv
```

This runs the tool against the **4 illustrative `EXAMPLE-P0x` rows** in the
template — one per RQ2 interview focus area (chaining realism, understanding
of attack progression, comparison to single-layer platforms, engagement) —
so you can see the expected output shape before coding a single real
interview. Every output from this run is prefixed `_EXAMPLE_`
(`_EXAMPLE_rq2_theme_summary.csv`, `_EXAMPLE_fig_thematic_map.png`, ...) and
the console banner reads `[EXAMPLE DATA — NOT REAL RESULTS]` — the same
`_SYNTHETIC_`-prefix convention `run_analysis.py` uses for RQ1, so an
un-edited template can never be mistaken for a real result. **These 4 rows
are illustrative only — delete them before coding real interviews.**

If `data/interview_coding.csv` still contains leftover `EXAMPLE-P0x` rows
alongside real ones, the tool warns and excludes them from the summary
rather than silently mixing fabricated and real excerpts.

### Anonymisation

The `participant_code` column is the only participant identifier this tool
ever sees or stores — `P01`, `P02`, ... A real name must never be entered
into the coding CSV. `analysis/data/` (both the input coding CSV and every
RQ2 output) is listed in `analysis/.gitignore` — real, anonymised interview
data is still sensitive research data and is never committed.

### Do not (RQ2)

- Do not use an LLM, or any automated method, to generate or suggest a
  code, a theme, or a quote — every one must come from the researcher's own
  reading of the interview.
- Do not enter a participant's real name anywhere in the coding CSV.
- Do not treat a run against `interview_coding_template.csv` (or any file
  whose rows are still `EXAMPLE-P0x`) as real findings.

---

## RQ3 — hint usage

**How AI-assisted hint usage relates to learners' progression and
perceived learning.**

### Framing: exploratory and descriptive, not causal

This study has **no hint/no-hint control group** and a **small sample**.
`hint_analysis.py` can therefore describe *what learners did* (uptake,
escalation depth, AI-vs-fallback source) and, where enough data exists, a
**descriptive association** between hint usage and learning gain — it
cannot and does not claim hints caused, helped, or hurt learning. Every
place a hint-usage/gain relationship is reported — console, CSV, and the
scatter figure's own title — says this explicitly. A correlation
coefficient is only computed at N ≥ 3 overlapping participants (below that,
a coefficient is not just weak, it is not meaningful — Pearson's r on 2
points is trivially ±1); below that threshold the raw per-participant pairs
are shown instead of a number.

### What it measures (behavioural — real `hint_unlocks` telemetry only)

- **Uptake**: how many/what % of participants (of all participant-role
  users) used at least one hint.
- **Usage depth**: distribution of the deepest tier each participant
  reached (Tier 1 only / up to Tier 2 / up to Tier 3 — hints are revealed
  progressively, server-enforced, so "max tier reached" already implies
  every lower tier was used too), overall and per layer.
- **Per-participant totals**: total hints used and XP spent on them.
- **AI vs fallback source**: how often the real Claude path served the hint
  vs. the pre-written fallback (`hint_unlocks.source`) — evidence the AI
  feature actually operated, separate from whether it helped anyone.

### What it measures (descriptive association with RQ1 — NOT causal)

For participants who have BOTH hint-usage data and a complete RQ1 pre/post
pair, `hint_analysis.py` joins per-participant total hints to their total
learning gain (`post_total - pre_total`, from `db_loader.load_wide_from_db()`
— the exact same paired frame RQ1's own analysis uses; no scoring is
reimplemented here) and reports Pearson r and Spearman rho (N ≥ 3 only),
always alongside the non-causal caveat above.

### Run it

```bash
cd analysis
python hint_analysis.py
```

Reads real `hint_unlocks` (joined to `challenges` for layer) via
`hint_loader.py`, which reuses `db_loader.py`'s DB connection and
`_anonymise()` — so a participant's code here is the SAME code their RQ1
assessment data uses (shared `participant_map.json`), which is what makes
relating the two datasets meaningful at all. No credentials are duplicated;
no second participant-code mapping is created.

Writes to `analysis/exports/` (gitignored): `rq3_hint_summary.csv`,
`rq3_hint_depth_distribution.csv`, `rq3_hint_source_breakdown.csv`,
`rq3_hint_vs_gain.csv` (only if N ≥ 1 participant has both hint and gain
data), `fig_hint_depth.png`, `fig_hint_source.png`, and `fig_hint_vs_gain.png`
(only if that join is non-empty).

If `hint_unlocks` is empty, it reports "no hint usage recorded yet" and
exits — no figures, no fabricated numbers. If hint data exists but fewer
than 2 participants currently have a complete pre/post pair (RQ1's own
threshold), the behavioural section still runs in full; only the
usage-vs-gain section reports that it can't be computed yet.

### The qualitative side of RQ3

What learners *said* about the hints (did a hint help understanding, give
too much away, feel like it should've been optional, etc.) is coded and
analysed with **RQ2's thematic-analysis tool** (`thematic_analysis.py`),
using hint-focused codes the researcher assigns — e.g. `hint_helped_
understanding`, `hint_gave_too_much_away`, `preferred_no_hint`, rolled up
into whatever themes emerge from the real coding. No new qualitative script
exists or is needed for this: copy `interview_coding_template.csv`, code
hint-related excerpts the same way as any other RQ2 excerpt, and run
`thematic_analysis.py` as documented above. The behavioural (this section)
and qualitative (RQ2 tool) sides of RQ3 are reported together in the
dissertation but computed by two separate, independent tools.

### Anonymisation

`hint_loader.fetch_real_hint_frame()` calls `db_loader._anonymise()` — the
identical function RQ1 uses — so hint-usage participant codes are drawn
from, and written back into, the SAME `analysis/participant_map.json` as
RQ1's. No `hint_text` (the actual hint content) is ever read or exported;
only behavioural telemetry (tier, cost, source, timestamp) leaves the
database. `analysis/exports/` is gitignored, and `*rq3_*.csv` is listed
separately for defence-in-depth.

### Do not (RQ3)

- Do not present the hint-usage/learning-gain relationship, at any sample
  size, as evidence that hints improve or harm learning — there is no
  control group, and the framing above must accompany every report of it.
- Do not compute a correlation coefficient below N = 3 overlapping
  participants — show the raw pairs instead.
- Do not read or export `hint_unlocks.hint_text`.
