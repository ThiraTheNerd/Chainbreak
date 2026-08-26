"""
hint_loader.py
===============
Loads REAL hint-usage telemetry from the ChainBreak MySQL `hint_unlocks`
table for RQ3 (how AI-assisted hint usage relates to learners' progression
and perceived learning).

Reuses db_loader.py's DB connection and participant-code anonymisation
(`_connect()`, `_anonymise()`) rather than duplicating credentials or
re-deriving a second mapping — a participant's code here is IDENTICAL to
their code in the RQ1 assessment data (same shared participant_map.json),
which is what makes relating hint usage to learning gain meaningful at all.

No `hint_text` is read — it can contain the actual hint content, and RQ3
only needs the behavioural telemetry (who, which challenge/layer, what
tier, what it cost, whether Claude or the fallback served it, when).
"""

from __future__ import annotations
import pandas as pd

from db_loader import _connect, _anonymise

TIDY_COLUMNS = ["participant_id", "challenge_id", "layer", "tier", "cost", "source", "created_at"]

# Same layer-key mapping used elsewhere (e.g. server/services/progress.service.js)
LAYER_KEY = {"owasp": "web", "docker": "container", "aws": "cloud"}


def _fetch_hint_unlocks(conn, driver: str) -> list[dict]:
    """Every hint reveal across every participant, joined to the challenge's
    layer. Deliberately excludes hint_text (flag-relevant content, not
    needed for behavioural analysis)."""
    query = (
        "SELECT h.user_id, h.challenge_id, c.layer, h.tier, h.cost, h.source, h.created_at "
        "FROM hint_unlocks h JOIN challenges c ON c.id = h.challenge_id"
    )
    cursor = conn.cursor(dictionary=True) if driver == "mysql.connector" else conn.cursor()
    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    return list(rows)


def _fetch_total_participants(conn, driver: str) -> int:
    """Total participant-role users — the denominator for hint-uptake %."""
    query = "SELECT COUNT(*) AS total FROM users WHERE role = 'participant'"
    cursor = conn.cursor(dictionary=True) if driver == "mysql.connector" else conn.cursor()
    cursor.execute(query)
    row = cursor.fetchone()
    cursor.close()
    return int((row["total"] if isinstance(row, dict) else row[0]) or 0)


def fetch_real_hint_frame() -> pd.DataFrame:
    """Anonymised tidy frame, one row per hint reveal. Anonymisation reuses
    db_loader._anonymise(), so this NEVER assigns a participant a different
    code than the one their assessment data already has (or will have)."""
    conn, driver = _connect()
    try:
        rows = _fetch_hint_unlocks(conn, driver)
    finally:
        conn.close()

    if not rows:
        return pd.DataFrame(columns=TIDY_COLUMNS)

    mapping = _anonymise([row["user_id"] for row in rows])

    tidy_rows = [{
        "participant_id": mapping[str(row["user_id"])],
        "challenge_id": row["challenge_id"],
        "layer": LAYER_KEY.get(row["layer"], row["layer"]),
        "tier": int(row["tier"]),
        "cost": int(row["cost"]),
        "source": row["source"],
        "created_at": row["created_at"],
    } for row in rows]
    return pd.DataFrame(tidy_rows, columns=TIDY_COLUMNS)


def fetch_total_participant_count() -> int:
    """Denominator for "X of Y (Z%) participants used at least one hint"."""
    conn, driver = _connect()
    try:
        return _fetch_total_participants(conn, driver)
    finally:
        conn.close()
