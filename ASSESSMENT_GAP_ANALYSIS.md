# ChainBreak Assessment Feature — Gap Analysis vs. Dissertation Evaluation Methodology

_Analysis only — no code changed. Written 2026-08-30 against the code as it currently stands._

## 1. What the Assessment feature currently does (factual)

**Files**: [client/src/pages/Assessment.jsx](client/src/pages/Assessment.jsx),
[client/src/hooks/useAssessment.js](client/src/hooks/useAssessment.js),
[client/src/lib/assessmentQuestions.js](client/src/lib/assessmentQuestions.js),
[server/routes/assessment.js](server/routes/assessment.js) (inline handler — bypasses the
controller/service/repository layering used everywhere else in the server), backed by the
`assessments` table in [server/db/schema.sql](server/db/schema.sql).

- A learner navigating to `/assessment` first picks **"Pre-session assessment"** or
  **"Post-session assessment"** (`type = 'pre' | 'post'`) — a self-selected label, not something
  the system enforces or verifies (nothing stops someone picking "post" first, or "pre" twice).
- Both types serve the **exact same 30-question multiple-choice instrument**
  (`lib/assessmentQuestions.js`): Q1–10 web security, Q11–20 container security, Q21–30 cloud
  security, 4 options each, one correct answer per question. Using the same instrument both times
  is correct and necessary for a valid pre/post design — this part is done right.
- A **client-side 15-minute countdown timer** (`useAssessment.js`) starts on mount; at zero,
  further answer selection and submission are disabled. The timer is not enforced or recorded
  server-side — a page reload resets it.
- On submit, the client posts `{ type, answers: [{questionId, answer}, ...] }` to
  `POST /api/assessment`. The server scores against a **hardcoded answer key**
  (`ANSWER_KEY` in `routes/assessment.js`, duplicated from — and manually kept in sync with — the
  `correct: true` flags in `assessmentQuestions.js`), producing `score_web`/`score_container`/
  `score_cloud` (0–10 each) and writes one row via
  `INSERT ... ON DUPLICATE KEY UPDATE` keyed on `(user_id, type)`.
- The results screen shows the three section scores and a total out of 30 with a percentage —
  nothing else. `GET /api/assessment/mine` returns the raw stored rows for the logged-in user
  (used nowhere in the current UI beyond what's shown immediately after submission).

**Storage** — `assessments` table:
```sql
assessments(id, user_id → users.id, type ENUM('pre','post'), answers JSON,
            score_web, score_container, score_cloud, submitted_at,
            UNIQUE (user_id, type))
```
The `UNIQUE(user_id, type)` constraint means **at most one 'pre' row and one 'post' row can ever
exist per user** — and because the insert is `ON DUPLICATE KEY UPDATE`, a second attempt at the
same type **silently overwrites** the first (including `submitted_at`). There is no attempt
history and no way to detect after the fact that an overwrite happened.

## 2. Requirement-by-requirement gap table

| # | Requirement | Status | Detail |
|---|---|---|---|
| 1a | Knowledge component (concepts, not flag recall) | **Present** | All 30 questions test transferable security concepts (OWASP categories, SQLi mitigation, docker.sock risk, Linux capabilities, IMDS/IAM, least privilege, etc.) via plausible distractors. **None reference actual flag values or platform-specific trivia** — this is a genuine strength, not a gap. See §6 for one content-coverage note (SUID specifically). |
| 1b | Confidence/self-efficacy component (Likert 1–5 per skill) | **Missing** | No Likert-scale item exists anywhere in the codebase. `QUESTIONS` is 100% multiple-choice knowledge items; there is no self-rating UI, no `confidence` field in the `answers` JSON or the `assessments` table. |
| 1c | Distinguish pre vs. post per participant, compute learning gain | **Partial** | The `type` field and `UNIQUE(user_id, type)` constraint *do* give you exactly one pre row and one post row per user to diff — the minimum needed. But: (a) nothing computes the gain or normalized gain anywhere — `GET /api/assessment/mine` returns raw rows only; (b) a second submission of the same type silently overwrites the first with no audit trail; (c) `type` is self-selected by the learner in the UI with no server-side enforcement of "pre must precede using the platform" — a participant could take "post" before touching any challenge. |
| 2 | System Usability Scale (SUS), 10-item, scored 0–100 | **Missing** | No SUS instrument, no SUS-style Likert items, no `sus_score` field, no post-study usability survey of any kind exists anywhere in the client or server. |
| 3 | Task metrics: completion rate, time-on-task, hints-used | **Partial** | Completion rate and rough time-on-task are *derivable* from existing tables (see §3) but nothing computes or exposes them today — no report, no endpoint, no admin view. Hints-used is a **hard Missing**: no hint feature exists at all (see below). |
| 4 | Semi-structured interview support | **Out of scope per brief** | Confirmed nothing lightweight exists either — no free-text feedback field, no comments box, anywhere in the app. |
| 5 | Consent, anonymized participant ID, demographics | **Missing** | Registration (`client/src/pages/Register.jsx` → `POST /api/auth/register`) collects only `username`, `email`, `password`. The `users` table (`id, username, email, password_hash, role, created_at`) has no consent flag/timestamp, no demographics fields, and no researcher-assigned anonymous participant code distinct from the learner's own chosen username/email (which are real, potentially identifying values). The seeded usernames `p01`/`p02` in `seed.js` look like an intended participant-code convention, but nothing in the code enforces, generates, or requires it — a real participant could register with their real name. |

## 3. What the platform already captures that serves the evaluation

Worth being precise about this so nothing gets needlessly rebuilt.

- **Every flag attempt, correct or not, with a timestamp** — `submissions(id, user_id,
  challenge_id, correct, submitted_at)`. This is real, working data (verified throughout the
  challenge-1 build work in this project) — every SQLi bypass, broken-access hit, SSH pivot,
  privesc, and AWS-creds capture writes a row here the moment the flag scanner matches it.
- **Session start/end timestamps** — `sessions(id, user_id, challenge_id, status, created_at,
  expires_at, ended_at)`. `created_at` is a genuine "task started" timestamp per
  challenge-attempt.
- **Points/XP per solve** — `submission.repository.scoreForUser` sums `points` over distinct
  solved challenges; this is what the dashboard's XP ring already displays.
- **Per-challenge metadata already includes the concept it teaches** — `challenges.category`
  (e.g. `'A03:2021 Injection'`, `'Privilege escalation (SUID)'`, `'Lateral movement / credential
  pivot'`) and `layer` (`owasp`/`docker`/`aws`) — useful for mapping task performance back onto
  the same concept taxonomy the knowledge-test sections use.

**What's genuinely missing from the automatic-capture side, not just unreported:**
- **No `session_id` on `submissions`.** You can approximate "time from session start to this
  flag" by matching a submission's `submitted_at` against whichever session row's
  `created_at`–`expires_at` window contains it (fragile if a user re-provisioned the same
  challenge more than once), but there's no direct foreign key. A precise per-attempt
  time-on-task needs this link added.
- **No hints feature exists at all**, so there is no "hints used" count to derive from anything
  — `MissionBrief.jsx`'s "Hints" tab is a static placeholder ("AI hint system... implemented in
  Phase 5"), not an interactive feature. This can't be backfilled from existing data; it has to
  be built before it can be measured.
- **No per-participant completion-rate report.** The raw joins to produce one exist
  (`submissions` × `challenges` × `users`), but nothing currently aggregates or exposes it.

## 4. Prioritized build list (most → least critical)

1. **Fix the pre/post data-integrity risk first.** Before adding anything new, the silent
   overwrite-on-resubmit (`ON DUPLICATE KEY UPDATE`) is the single fastest way to lose real study
   data. At minimum, either block a second submission of the same `type` for a user server-side,
   or move to an attempts-log model (drop the `UNIQUE(user_id, type)` constraint, add an
   `attempt_number`, and pick the first-of-each-type at analysis time) rather than trusting the
   UI to never be used twice.
2. **Add the confidence/self-efficacy Likert component to the existing instrument.** This is an
   *extension* of what's already built (same page, same submission flow, same `answers` JSON
   shape can carry a parallel array of `{skillId, rating}`), not a new subsystem — the fastest
   path to closing requirement 1b.
3. **Build and expose a learning-gain computation.** Once (1) and the pre/post rows are trusted,
   `g = (post − pre) / (max − pre)` is pure arithmetic over `assessments.score_web/container/
   cloud` (or a new total column) — an endpoint or even an offline analysis script over the
   existing table would satisfy this; it does not require new instrumentation.
4. **Add `session_id` (nullable FK) to `submissions`.** Small schema change, but it's the
   difference between an approximate and an exact time-on-task metric, and it's far cheaper to
   add now than to reconstruct retroactively once study data exists.
5. **Build a minimal hints feature with usage tracking**, if hints are meant to be part of the
   platform experience being evaluated at all — this is a real feature gap, not just a reporting
   gap, and the most labor-intensive item on this list. If hints aren't actually needed for the
   study, drop this item and note in the methodology that hint-usage wasn't tracked because the
   feature doesn't exist.
6. **Add a SUS instrument.** Standard, well-documented 10-item form — a new page/route
   (`/assessment/sus` or a step after "post"), a small `sus_responses` table or a JSON column,
   and the standard 0–100 conversion formula. Self-contained; doesn't depend on anything else on
   this list.
7. **Add participant consent + an anonymized participant code + minimal demographics
   (experience level).** Needs a small schema addition (`consent_at`, `participant_code`,
   `experience_level` or similar on `users`, or a separate `participants` table if you want it
   decoupled from login identity entirely) and a one-time registration/consent step in the UI.
   Ranked last only because it's independent of the others and can be retrofitted onto existing
   accounts, but it should exist **before** recruiting real participants, not after — flagging its
   priority-of-timing separately from its position in this build-effort list.
8. **Build the completion-rate/time-on-task reporting view.** Lowest priority because the
   underlying data (once #4 lands) already supports it — this is a query/dashboard convenience
   for the researcher, not something blocking data collection itself.

## 5. Honest flags

- **The knowledge component does NOT test flag recall — this is a strength, not a gap.** Every
  question was written around a transferable concept with plausible distractors; none reference
  ChainBreak's own flag values or platform-specific trivia. Called out explicitly because the
  brief asked me to watch for exactly this failure mode, and it isn't present.
- **One real content-coverage gap in the knowledge component**: the container-security section
  (Q11–20) tests `--privileged`, `docker.sock`, namespaces/cgroups, Linux capabilities, volume
  mounts, non-root `USER`, and container-escape definitions in general — but **no question
  specifically tests SUID-binary privilege escalation** (`setuid`/`4755`/`find -perm -4000`),
  which is the actual, central mechanic of Challenge 1's docker layer (`sqli-privesc-root`). A
  participant could ace the knowledge test's container section on general container-hardening
  knowledge without ever having understood the specific technique the platform spends the most
  effort teaching. Worth a targeted item or two before running a real study.
- **Pre/post `type` is self-selected and server-unenforced.** Nothing prevents a participant
  from taking "post" before ever touching a challenge, or retaking "pre" (silently destroying the
  original — see §4 item 1). For research validity, this needs either UI gating (disable "post"
  until some platform activity is recorded) or, at minimum, a written protocol instruction plus
  the data-integrity fix in §4.
- **No anonymization exists.** `username`/`email` are real, learner-chosen, potentially
  identifying values, stored and returned as-is throughout the API (e.g. the leaderboard shows
  `username`). If the study requires anonymized participant tracking, that has to be built —
  it does not currently exist in any form beyond the *suggestion* of one in seeded demo usernames
  (`p01`, `p02`) that isn't enforced anywhere.
- **The answer key is duplicated, not derived.** `routes/assessment.js`'s `ANSWER_KEY` object and
  `assessmentQuestions.js`'s per-option `correct: true` flags are two independent sources of
  truth that a future question edit could silently desync (edit one, forget the other) — not a
  research-validity issue today since I verified they currently agree, but worth knowing before
  editing the question bank.
