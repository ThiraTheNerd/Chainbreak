"""
db_loader.py
============
Loads REAL participant pre/post assessment data from the ChainBreak MySQL
database (`assessments` table) into the same tidy shape learning_gain.py's
load_scores() expects from a CSV, then delegates to load_scores() so every
row goes through the exact same tested validation/pairing logic the CSV
workflow already uses. No analysis logic lives here — only data loading.

Credentials: read from server/.env (the SAME file the Node backend reads —
see server/config/env.js), never duplicated or hardcoded. Required vars:
DB_HOST, DB_PORT (optional, default 3306), DB_USER, DB_PASS, DB_NAME.

Canonical attempt: only attempt_number = 1 rows are read, matching how
server/routes/assessment.js's GET /mine treats resubmissions — the first
attempt of each type is the one used for analysis, never silently replaced
by a later resubmission (see the comment on that route).

Confidence total: server/routes/assessment.js validates `confidence` as an
array of exactly 5 {itemId, rating} objects (ratings 1-5) and stores it
VERBATIM as confidence_ratings JSON — it never reduces it to a single number
itself (unlike SUS, which the server scores with reverse-coding via
computeSusScore()). Confidence has no reverse-scored items, so the 0..25
total here is simply the sum of the 5 stored ratings — this matches the
server's own handling exactly because the server does no more than store
the raw ratings.

Anonymisation: a real user_id is mapped to a stable participant code
(P01, P02, ...) INSIDE fetch_real_tidy_frame(), before any DataFrame is
returned, written to disk, or handed to the analysis functions. The mapping
persists in participant_map.json (gitignored — see analysis/.gitignore) so
the same participant keeps the same code across repeated runs; that file is
the only place a real user_id and a participant code are ever linked.
"""

from __future__ import annotations
import json
import os
import tempfile
from pathlib import Path

import pandas as pd

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

import learning_gain as lg

ANALYSIS_DIR = Path(__file__).resolve().parent
REPO_ROOT = ANALYSIS_DIR.parent
PARTICIPANT_MAP_PATH = ANALYSIS_DIR / "participant_map.json"
EXPORT_PATH = ANALYSIS_DIR / "exports" / "real_data_export.csv"

TIDY_COLUMNS = ["participant_id", "phase", "score_web", "score_container",
                 "score_cloud", "score_total", "confidence"]


def _load_env() -> dict:
    """Reuse server/.env — the same credentials the Node backend connects with."""
    if load_dotenv is not None:
        load_dotenv(REPO_ROOT / "server" / ".env")
    required = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise RuntimeError(
            f"Missing DB env var(s): {missing}. Expected them in server/.env "
            f"(the same file the Node server reads) — see analysis/README.md."
        )
    return {
        "host": os.environ["DB_HOST"],
        "port": int(os.environ.get("DB_PORT", 3306)),
        "user": os.environ["DB_USER"],
        "password": os.environ["DB_PASS"],
        "database": os.environ["DB_NAME"],
    }


def _connect():
    """Returns (connection, driver_name). Tries PyMySQL first, then mysql-connector-python."""
    creds = _load_env()
    try:
        import pymysql
        conn = pymysql.connect(
            host=creds["host"], port=creds["port"], user=creds["user"],
            password=creds["password"], db=creds["database"],
            cursorclass=pymysql.cursors.DictCursor,
        )
        return conn, "pymysql"
    except ImportError:
        pass
    try:
        import mysql.connector
        conn = mysql.connector.connect(
            host=creds["host"], port=creds["port"], user=creds["user"],
            password=creds["password"], database=creds["database"],
        )
        return conn, "mysql.connector"
    except ImportError:
        raise RuntimeError(
            "No MySQL driver installed. Run: pip install -r analysis/requirements.txt"
        )


def _fetch_canonical_attempts(conn, driver: str) -> list[dict]:
    """attempt_number = 1 rows only — the canonical first attempt of each
    type, exactly as server/routes/assessment.js's GET /mine treats it."""
    query = (
        "SELECT user_id, type, score_web, score_container, score_cloud, confidence_ratings "
        "FROM assessments WHERE attempt_number = 1"
    )
    cursor = conn.cursor(dictionary=True) if driver == "mysql.connector" else conn.cursor()
    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    return list(rows)


def _confidence_total(confidence_ratings_json) -> float | None:
    """Sum of the 5 stored {itemId, rating} entries -> a 0..25 total.

    Matches server/routes/assessment.js exactly: the server validates this
    array (validateLikertArray, 5 items, 1-5 each) but never reduces it to a
    single number itself — unlike SUS (computeSusScore), which reverse-scores
    odd/even items. Confidence has no reverse-scoring, so the total here is a
    plain sum, which is all the server's own logic implies.
    """
    if confidence_ratings_json is None:
        return None
    data = confidence_ratings_json
    if isinstance(data, str):
        data = json.loads(data)
    if not isinstance(data, list) or not data:
        return None
    return float(sum(entry["rating"] for entry in data))


def _load_participant_map() -> dict:
    if PARTICIPANT_MAP_PATH.exists():
        return json.loads(PARTICIPANT_MAP_PATH.read_text())
    return {}


def _save_participant_map(mapping: dict) -> None:
    PARTICIPANT_MAP_PATH.write_text(json.dumps(mapping, indent=2, sort_keys=False))


def _anonymise(user_ids: list[int]) -> dict:
    """Map each real user_id to a stable participant code (P01, P02, ...).

    Stable across runs: an id that already has a code keeps it; a new id
    gets the next unused number. participant_map.json is the ONLY place a
    real user_id and a participant code are linked — it is gitignored (see
    analysis/.gitignore) because it is a re-identification key over
    sensitive research data and must never be committed.
    """
    mapping = _load_participant_map()
    used_numbers = {int(code[1:]) for code in mapping.values()}
    next_number = (max(used_numbers) + 1) if used_numbers else 1
    for uid in sorted(set(user_ids)):
        key = str(uid)
        if key not in mapping:
            mapping[key] = f"P{next_number:02d}"
            next_number += 1
    _save_participant_map(mapping)
    return mapping


def fetch_real_tidy_frame() -> pd.DataFrame:
    """Builds the tidy long-format frame learning_gain.load_scores() expects
    from a CSV — participant_id, phase, score_web, score_container,
    score_cloud, score_total, confidence — from REAL `assessments` rows.

    Anonymisation happens here, before this frame is returned to any caller
    or written to disk — no raw user_id ever leaves this function.
    """
    conn, driver = _connect()
    try:
        rows = _fetch_canonical_attempts(conn, driver)
    finally:
        conn.close()

    if not rows:
        return pd.DataFrame(columns=TIDY_COLUMNS)

    mapping = _anonymise([row["user_id"] for row in rows])

    tidy_rows = []
    for row in rows:
        web, container, cloud = row["score_web"], row["score_container"], row["score_cloud"]
        tidy_rows.append({
            "participant_id": mapping[str(row["user_id"])],
            "phase": row["type"],
            "score_web": web,
            "score_container": container,
            "score_cloud": cloud,
            "score_total": web + container + cloud,
            "confidence": _confidence_total(row["confidence_ratings"]),
        })
    return pd.DataFrame(tidy_rows, columns=TIDY_COLUMNS)


def load_wide_from_db(export_csv: bool = True):
    """Real-data entry point for `run_analysis.py --from-db`.

    Returns (wide_dataframe_or_None, total_participants_considered).
    Delegates ALL pairing/validation to learning_gain.load_scores() by
    writing the anonymised tidy frame to a CSV and loading it back through
    the exact same tested code path the CSV workflow uses — no analysis
    logic is duplicated here.

    Guards one edge case load_scores() doesn't: if an ENTIRE phase (e.g. no
    'post' row exists anywhere yet, which is the real state of this project
    today) is missing from the data, load_scores()'s pivot has no post_*
    columns to compare against at all, so its dropna-based "complete pair"
    check passes every pre-only participant through as if paired — then
    learning_gain.analyse() raises KeyError('post_web') reaching for a
    column that was never there. Rather than patch that into
    learning_gain.py, this loader checks the returned frame actually has
    every pre_/post_ column each domain needs, and reports "not enough real
    pairs yet" (same as too few rows) instead of letting that surface as a
    crash.

    When export_csv=True (the default), the anonymised export is kept at
    analysis/exports/real_data_export.csv for audit/reproducibility — that
    path is gitignored (see analysis/.gitignore): even though it is
    anonymised, it is still real participant data.
    """
    tidy = fetch_real_tidy_frame()
    total_participants = tidy["participant_id"].nunique() if len(tidy) else 0
    if tidy.empty:
        return None, 0

    header = (
        "# REAL ChainBreak participant data, anonymised (participant_id is a stable\n"
        "# code, not the database user_id — see analysis/participant_map.json).\n"
        "# Exported by analysis/db_loader.py from the `assessments` table\n"
        "# (attempt_number = 1 rows only).\n"
    )

    if export_csv:
        EXPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(EXPORT_PATH, "w") as f:
            f.write(header)
            tidy.to_csv(f, index=False)
        wide = lg.load_scores(str(EXPORT_PATH))
    else:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(header)
            tidy.to_csv(f, index=False)
            temp_path = f.name
        try:
            wide = lg.load_scores(temp_path)
        finally:
            os.unlink(temp_path)

    required_cols = [f"{phase}_{dom}" for phase in ("pre", "post") for dom in list(lg.DOMAIN_MAX) + ["total"]]
    if any(col not in wide.columns for col in required_cols):
        return None, total_participants
    if len(wide) < 2:
        return None, total_participants
    return wide, total_participants
