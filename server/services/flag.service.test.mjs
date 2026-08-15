import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import pool from '../db/connection.js';
import * as flagService from './flag.service.js';

const TEST_USERNAME = 'zz_test_migration_user';
const MODULE_IMAGE  = 'zz-test-image';

let userId;
let challengeA; // module member 1 — the one sessions are "started" against
let challengeB; // module member 2 — sibling sharing the same docker_image
let standaloneChallenge; // no docker_image — single-candidate case

async function insertChallenge({ slug, title, layer, points, flag, dockerImage }) {
  const flagHash = await bcrypt.hash(flag, 4); // low rounds — this is a test fixture, not real auth
  const [result] = await pool.query(
    `INSERT INTO challenges (slug, title, description, layer, category, difficulty, points, flag_hash, docker_image)
     VALUES (:slug, :title, 'test fixture', :layer, 'test', 'easy', :points, :flagHash, :dockerImage)`,
    { slug, title, layer, points, flagHash, dockerImage }
  );
  return { id: result.insertId, flag };
}

before(async () => {
  const [userResult] = await pool.query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES (:username, 'zz_test_migration_user@test.local', 'x', 'participant')`,
    { username: TEST_USERNAME }
  );
  userId = userResult.insertId;

  challengeA = await insertChallenge({
    slug: 'zz-test-module-a', title: 'zz test module a', layer: 'owasp',
    points: 100, flag: 'flag{zz_test_module_a}', dockerImage: MODULE_IMAGE,
  });
  challengeB = await insertChallenge({
    slug: 'zz-test-module-b', title: 'zz test module b', layer: 'docker',
    points: 150, flag: 'flag{zz_test_module_b}', dockerImage: MODULE_IMAGE,
  });
  standaloneChallenge = await insertChallenge({
    slug: 'zz-test-standalone', title: 'zz test standalone', layer: 'owasp',
    points: 300, flag: 'flag{zz_test_standalone}', dockerImage: null,
  });
});

after(async () => {
  // Cascades delete every submissions/completions row created by these
  // tests, via fk_sub_user/fk_completions_user and fk_sub_challenge/
  // fk_completions_challenge ON DELETE CASCADE.
  await pool.query(`DELETE FROM users WHERE id = :userId`, { userId });
  await pool.query(`DELETE FROM challenges WHERE docker_image = :img`, { img: MODULE_IMAGE });
  await pool.query(`DELETE FROM challenges WHERE id = :id`, { id: standaloneChallenge.id });
  await pool.end();
});

async function countSubmissions(challengeId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM submissions WHERE user_id = :userId AND challenge_id = :challengeId`,
    { userId, challengeId }
  );
  return Number(rows[0].n);
}

async function countCompletions(challengeId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM completions WHERE user_id = :userId AND challenge_id = :challengeId`,
    { userId, challengeId }
  );
  return Number(rows[0].n);
}

test('malformed flag is rejected before any DB write', async () => {
  await assert.rejects(
    () => flagService.submitFlagForChallenge({
      userId, challengeId: challengeA.id, submittedFlag: 'not-a-flag',
    }),
    /Malformed flag/
  );
  assert.equal(await countSubmissions(challengeA.id), 0);
});

test('submitFlagForChallenge: incorrect flag creates exactly one attempt, no completion', async () => {
  const result = await flagService.submitFlagForChallenge({
    userId, challengeId: standaloneChallenge.id, submittedFlag: 'flag{wrong_answer_here}',
  });
  assert.equal(result.correct, false);
  assert.equal(result.pointsAwarded, 0);
  assert.equal(await countSubmissions(standaloneChallenge.id), 1);
  assert.equal(await countCompletions(standaloneChallenge.id), 0);
});

test('submitFlagForChallenge: correct flag creates one attempt, one completion, awards points once', async () => {
  const result = await flagService.submitFlagForChallenge({
    userId, challengeId: standaloneChallenge.id, submittedFlag: standaloneChallenge.flag,
  });
  assert.equal(result.correct, true);
  assert.equal(result.alreadySolved, false);
  assert.equal(result.pointsAwarded, 300);
  assert.equal(await countSubmissions(standaloneChallenge.id), 2); // the prior incorrect + this correct
  assert.equal(await countCompletions(standaloneChallenge.id), 1);

  // Second correct submission: a real, recorded attempt (research history),
  // but no second completion and no repeat points.
  const replay = await flagService.submitFlagForChallenge({
    userId, challengeId: standaloneChallenge.id, submittedFlag: standaloneChallenge.flag,
  });
  assert.equal(replay.correct, true);
  assert.equal(replay.alreadySolved, true);
  assert.equal(replay.pointsAwarded, 0);
  assert.equal(await countSubmissions(standaloneChallenge.id), 3);
  assert.equal(await countCompletions(standaloneChallenge.id), 1);
});

test('submitFlagForChallenge: concurrent correct submissions cannot create duplicate completions', async () => {
  const [a, b] = await Promise.all([
    flagService.submitFlagForChallenge({ userId, challengeId: challengeA.id, submittedFlag: challengeA.flag }),
    flagService.submitFlagForChallenge({ userId, challengeId: challengeA.id, submittedFlag: challengeA.flag }),
  ]);
  const firstCompletions = [a, b].filter((r) => !r.alreadySolved).length;
  assert.equal(firstCompletions, 1, 'exactly one of the two concurrent requests should win the completion');
  assert.equal(await countCompletions(challengeA.id), 1);
  assert.equal(await countSubmissions(challengeA.id), 2); // both are real recorded attempts
});

test('submitFlagForSession: matches the correct sibling in the module and records exactly one attempt', async () => {
  // Session was "started" against challengeA, but the learner's shell
  // produced challengeB's flag — a legitimate multi-flag-module capture.
  const result = await flagService.submitFlagForSession({
    userId, sessionChallengeId: challengeA.id, submittedFlag: challengeB.flag,
  });
  assert.equal(result.correct, true);
  assert.equal(result.challengeId, challengeB.id);
  assert.equal(await countSubmissions(challengeB.id), 1);
  assert.equal(await countSubmissions(challengeA.id), 2); // unchanged from the prior test — no row leaked onto A
  assert.equal(await countCompletions(challengeB.id), 1);
});

test('submitFlagForSession: a flag matching no sibling records exactly one incorrect attempt, attributed to the session challenge — not one per candidate checked', async () => {
  const before = await countSubmissions(challengeA.id);
  const result = await flagService.submitFlagForSession({
    userId, sessionChallengeId: challengeA.id, submittedFlag: 'flag{matches_nothing_in_module}',
  });
  assert.equal(result.correct, false);
  assert.equal(result.challengeId, challengeA.id);
  assert.equal(await countSubmissions(challengeA.id), before + 1); // exactly one new row, not one per module member
  assert.equal(await countSubmissions(challengeB.id), 1); // untouched — no phantom candidate-resolution row
});

test('submitFlagForSession accepts no client-declared candidate list, and an unrelated challenge id never gets awarded', async () => {
  // The old (vulnerable) contract accepted a client-controlled
  // `challengeIds` array and tested every id in it. submitFlagForSession's
  // only inputs are the session's own challenge_id and the flag text — so
  // passing an unrelated id here (the equivalent of a malicious handshake
  // trying to redirect scoring) does nothing but change which module gets
  // resolved to, never which flag string is accepted for it.
  const result = await flagService.submitFlagForSession({
    userId,
    sessionChallengeId: standaloneChallenge.id, // unrelated to the challengeA/B module
    submittedFlag: challengeA.flag,             // a flag that is only valid for the OTHER module
  });
  assert.equal(result.correct, false, 'a flag from a different module must not validate against an unrelated session challenge');
});
