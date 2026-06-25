import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, evaluateFindings, findMatch, mapAlert, normaliseRisk, validateTarget } from './securityCentre.js';

// Fixture ground truth, independent of the real GROUND_TRUTH constant so these
// tests stay stable if the documented vulnerability set changes.
const FIXTURE_TRUTH = [
  { id: 'FX-A03-001', name: 'SQL Injection', owaspCategory: 'A03', layer: 'web', expected: true, expectedAlertNames: [] },
  { id: 'FX-A01-001', name: 'Path Traversal', owaspCategory: 'A01', layer: 'web', expected: true, expectedAlertNames: [] },
];

test('only accepts the internal nginx target', () => {
  assert.equal(validateTarget('http://nginx'), true);
  assert.equal(validateTarget('http://example.com'), false);
  assert.equal(validateTarget('http://nginx.evil.example'), false);
});

test('calculates deterministic severity-weighted score', () => {
  assert.equal(calculateScore({ critical: 1, high: 2, medium: 3, low: 4 }, 5), 41);
  assert.equal(calculateScore({ critical: 9 }, 5), 0);
  assert.equal(calculateScore({}, 0), null);
});

test('normalises ZAP risks and maps known alert families', () => {
  assert.equal(normaliseRisk(3), 'high');
  assert.equal(normaliseRisk('Informational'), 'informational');
  assert.deepEqual(mapAlert('SQL Injection'), { owaspCategory: 'A03', owaspMapping: 'direct' });
  assert.deepEqual(mapAlert('Unexpected custom alert'), { owaspCategory: null, owaspMapping: 'not_mapped' });
});

test('reports ground-truth evaluation only from supplied findings', () => {
  const evaluation = evaluateFindings([
    { alert_name: 'SQL Injection', url: 'http://nginx/login', description: '', owasp_category: 'A03', layer: 'web' },
  ]);
  assert.equal(evaluation.truePositives, 1);
  assert.equal(evaluation.falseNegatives, 6);
  assert.ok(Math.abs(evaluation.detectionRate - (100 / 7)) < 1e-9);
});

test('findMatch: matches via expectedAlertNames regardless of category or keyword', () => {
  const item = { name: 'Weak JWT Secret', owaspCategory: 'A02', expectedAlertNames: ['Custom JWT Weakness Alert'] };
  const finding = { alert_name: 'Custom JWT Weakness Alert', owasp_category: 'A99' };
  assert.equal(findMatch(item, [finding]), finding);
});

test('findMatch: matches on owasp_category equality plus an alert_name keyword hit', () => {
  const item = { name: 'SQL Injection', owaspCategory: 'A03', expectedAlertNames: [] };
  const finding = { alert_name: 'SQL Injection - MySQL', owasp_category: 'A03' };
  assert.equal(findMatch(item, [finding]), finding);
});

test('findMatch: same owasp_category without an alert_name keyword hit does not match', () => {
  const item = { name: 'SQL Injection', owaspCategory: 'A03', expectedAlertNames: [] };
  const finding = { alert_name: 'Cross Site Scripting', owasp_category: 'A03' };
  assert.equal(findMatch(item, [finding]), undefined);
});

test('findMatch: an alert_name keyword hit with a different owasp_category does not match', () => {
  const item = { name: 'SQL Injection', owaspCategory: 'A03', expectedAlertNames: [] };
  const finding = { alert_name: 'SQL Injection', owasp_category: 'A01' };
  assert.equal(findMatch(item, [finding]), undefined);
});

test('findMatch: a keyword only in description or url does not match (loose substring matching stays removed)', () => {
  const item = { name: 'SQL Injection', owaspCategory: 'A03', expectedAlertNames: [] };
  const finding = {
    alert_name: 'Unrelated Alert', owasp_category: 'A03',
    description: 'Possible SQL Injection found', url: 'http://nginx/sql-injection',
  };
  assert.equal(findMatch(item, [finding]), undefined);
});

test('findMatch: alert_name matching is case-insensitive', () => {
  const keywordItem = { name: 'SQL Injection', owaspCategory: 'A03', expectedAlertNames: [] };
  const keywordFinding = { alert_name: 'sql injection - mysql', owasp_category: 'A03' };
  assert.equal(findMatch(keywordItem, [keywordFinding]), keywordFinding);

  const expectedItem = { name: 'Weak JWT Secret', owaspCategory: 'A02', expectedAlertNames: ['Custom JWT Weakness Alert'] };
  const expectedFinding = { alert_name: 'custom jwt weakness alert', owasp_category: 'A99' };
  assert.equal(findMatch(expectedItem, [expectedFinding]), expectedFinding);
});

test('evaluateFindings: counts unique alert types separately from finding instances', () => {
  const findings = [
    { alert_name: 'SQL Injection', url: 'http://nginx/login', owasp_category: 'A03', layer: 'web' },
    { alert_name: 'SQL Injection', url: 'http://nginx/search', owasp_category: 'A03', layer: 'web' },
    { alert_name: 'SQL Injection', url: 'http://nginx/admin', owasp_category: 'A03', layer: 'web' },
  ];
  const evaluation = evaluateFindings(findings, FIXTURE_TRUTH);
  assert.equal(evaluation.uniqueAlertTypes, 1);
  assert.equal(evaluation.totalFindingInstances, 3);
});

test('evaluateFindings: a ground-truth item with no matching finding is a false negative', () => {
  const findings = [
    { alert_name: 'SQL Injection', url: 'http://nginx/login', owasp_category: 'A03', layer: 'web' },
  ];
  const evaluation = evaluateFindings(findings, FIXTURE_TRUTH);
  assert.equal(evaluation.truePositives, 1);
  assert.equal(evaluation.falseNegatives, 1);
  assert.equal(evaluation.matches.find(match => match.groundTruthId === 'FX-A01-001').matchedAlertName, null);
});

test('evaluateFindings: findings matching no ground-truth item are unique unmatchedFindings', () => {
  const findings = [
    { alert_name: 'Unrelated Alert', url: 'http://nginx/a', owasp_category: 'A05', layer: 'web' },
    { alert_name: 'Unrelated Alert', url: 'http://nginx/b', owasp_category: 'A05', layer: 'web' },
    { alert_name: 'Another Unrelated Alert', url: 'http://nginx/c', owasp_category: 'A06', layer: 'web' },
  ];
  const evaluation = evaluateFindings(findings, FIXTURE_TRUTH);
  assert.deepEqual(evaluation.unmatchedFindings.sort(), ['Another Unrelated Alert', 'Unrelated Alert']);
});

test('evaluateFindings: does not report an automatic falsePositives count', () => {
  const evaluation = evaluateFindings([], FIXTURE_TRUTH);
  assert.equal('falsePositives' in evaluation, false);
  assert.equal('falsePositiveRate' in evaluation, false);
});

test('evaluateFindings: an empty findings array yields zero true positives and all ground truth as false negatives', () => {
  const evaluation = evaluateFindings([], FIXTURE_TRUTH);
  assert.equal(evaluation.truePositives, 0);
  assert.equal(evaluation.falseNegatives, FIXTURE_TRUTH.length);
  assert.equal(evaluation.matches.every(match => match.matchedAlertName === null), true);
});

test('evaluateFindings: findings outside the web layer are excluded', () => {
  const findings = [
    { alert_name: 'SQL Injection', url: 'http://nginx/login', owasp_category: 'A03', layer: 'container' },
  ];
  const evaluation = evaluateFindings(findings, FIXTURE_TRUTH);
  assert.equal(evaluation.truePositives, 0);
  assert.equal(evaluation.totalFindingInstances, 0);
  assert.equal(evaluation.uniqueAlertTypes, 0);
});