import config from '../config/env.js';

export const OWASP_CATEGORIES = [
  ['A01', 'Broken Access Control'], ['A02', 'Cryptographic Failures'], ['A03', 'Injection'],
  ['A04', 'Insecure Design'], ['A05', 'Security Misconfiguration'], ['A06', 'Vulnerable and Outdated Components'],
  ['A07', 'Identification and Authentication Failures'], ['A08', 'Software and Data Integrity Failures'],
  ['A09', 'Security Logging and Monitoring Failures'], ['A10', 'Server-Side Request Forgery'],
].map(([id, name]) => ({ id, name }));

// This is separate from scanner output and records only checked-in challenge evidence.
// expectedAlertNames: exact ZAP alert names known to fire for this item (see evaluateFindings).
export const GROUND_TRUTH = [
  { id: 'CB1-A03-001', name: 'SQL Injection', owaspCategory: 'A03', layer: 'web', challenge: 'challenge-1', endpoint: 'POST /login', expected: true, expectedAlertNames: [] },
  { id: 'CB1-A01-001', name: 'Broken Access Control', owaspCategory: 'A01', layer: 'web', challenge: 'challenge-1', endpoint: 'GET /api/users', expected: true, expectedAlertNames: [] },
  { id: 'CB1-A01-002', name: 'Path Traversal', owaspCategory: 'A01', layer: 'web', challenge: 'challenge-1', endpoint: 'GET /api/admin/backup', expected: true, expectedAlertNames: [] },
  { id: 'CB2-A08-001', name: 'Insecure Deserialization', owaspCategory: 'A08', layer: 'web', challenge: 'challenge-2', endpoint: 'profile cookie middleware', expected: true, expectedAlertNames: [] },
  { id: 'CB2-A10-001', name: 'Verbose Error Disclosure', owaspCategory: 'A05', layer: 'web', challenge: 'challenge-2', endpoint: 'GET /', expected: true, expectedAlertNames: [] },
  { id: 'CB2-A07-001', name: 'Weak Authentication', owaspCategory: 'A07', layer: 'web', challenge: 'challenge-2', endpoint: 'POST /login', expected: true, expectedAlertNames: [] },
  { id: 'CB2-A02-001', name: 'Weak JWT Secret', owaspCategory: 'A02', layer: 'web', challenge: 'challenge-2', endpoint: 'GET /admin', expected: true, expectedAlertNames: [] },
  { id: 'CB1-DOCKER-001', name: 'Privileged container / SUID escalation', layer: 'container', challenge: 'challenge-1', expected: true },
  { id: 'CB2-DOCKER-001', name: 'Docker socket exposure', layer: 'container', challenge: 'challenge-2', expected: true },
  { id: 'CB1-CLOUD-001', name: 'Exposed IAM credentials', layer: 'cloud', challenge: 'challenge-1', expected: true },
  { id: 'CB2-CLOUD-001', name: 'LocalStack IAM/S3 misconfiguration', layer: 'cloud', challenge: 'challenge-2', expected: true },
];

const ALERT_MAPPINGS = [
  { test: /sql injection/i, category: 'A03', quality: 'direct' },
  { test: /cross site scripting|xss/i, category: 'A03', quality: 'direct' },
  { test: /path traversal|directory browsing|local file/i, category: 'A01', quality: 'approximate' },
  { test: /cookie without|csrf|access control/i, category: 'A01', quality: 'approximate' },
  { test: /authentication|session|password/i, category: 'A07', quality: 'approximate' },
  { test: /information disclosure|error message|server leaks/i, category: 'A05', quality: 'approximate' },
  { test: /component|outdated software/i, category: 'A06', quality: 'approximate' },
];

// The strict allowlist of scan targets. This is a SECURITY control:
// it prevents the scan feature from being abused to reach arbitrary internal
// hosts (SSRF). Only these three known targets may ever be scanned.
const ALLOWED_SCAN_TARGETS = new Map([
  ['nginx',           config.security.zapTarget],          // platform (via reverse proxy)
  ['web-challenge-1', 'http://web-challenge-1:3000'],      // challenge 1 target (direct)
  ['web-challenge-2', 'http://web-challenge-2:3000'],      // challenge 2 target (direct)
]);

export function mapAlert(alertName) {
  const match = ALERT_MAPPINGS.find(({ test }) => test.test(alertName));
  return match ? { owaspCategory: match.category, owaspMapping: match.quality } : { owaspCategory: null, owaspMapping: 'not_mapped' };
}

export function normaliseRisk(risk) {
  return ({ 3: 'high', 2: 'medium', 1: 'low', 0: 'informational', high: 'high', medium: 'medium', low: 'low', informational: 'informational' })[String(risk).toLowerCase()] || 'informational';
}

// Application-specific, deterministic metric: Critical=20, High=10, Medium=5, Low=1.
export function calculateScore(counts, endpointsFound) {
  if (!endpointsFound) return null;
  const penalty = (counts.critical || 0) * 20 + (counts.high || 0) * 10 + (counts.medium || 0) * 5 + (counts.low || 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function validateTarget(target) {
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:') return false;
    const allowed = ALLOWED_SCAN_TARGETS.get(parsed.hostname);
    // hostname must be in the allowlist AND the full target must match the
    // registered value for that host (no path/port smuggling).
    return Boolean(allowed) && target === allowed;
  } catch {
    return false;
  }
}

// A finding matches a ground-truth item on either: (a) an exact owasp_category
// match plus a keyword hit on alert_name (not url/description, which produce
// coincidental matches at scale), or (b) an exact hit against the item's
// declared expectedAlertNames.
export function findMatch(item, uniqueFindings) {
  const expectedNames = item.expectedAlertNames || [];
  return uniqueFindings.find(finding => {
    if (expectedNames.some(name => name.toLowerCase() === finding.alert_name.toLowerCase())) return true;
    return Boolean(item.owaspCategory) && finding.owasp_category === item.owaspCategory
      && finding.alert_name.toLowerCase().includes(item.name.toLowerCase());
  });
}

export function evaluateFindings(findings, groundTruth = GROUND_TRUTH) {
  const webTruth = groundTruth.filter(item => item.layer === 'web' && item.expected);
  const webFindings = findings.filter(finding => finding.layer === 'web');
  const totalFindingInstances = webFindings.length;
  // One representative finding row per distinct alert_name — ZAP reports the
  // same alert once per affected URL, so metrics are computed over types, not instances.
  const uniqueFindings = [...new Map(webFindings.map(finding => [finding.alert_name, finding])).values()];
  const uniqueAlertTypes = uniqueFindings.length;

  const matches = webTruth.map(item => {
    const matchedFinding = findMatch(item, uniqueFindings);
    return { groundTruthId: item.id, groundTruthName: item.name, matchedAlertName: matchedFinding ? matchedFinding.alert_name : null };
  });
  const truePositives = matches.filter(match => match.matchedAlertName).length;
  const falseNegatives = webTruth.length - truePositives;

  const matchedAlertNames = new Set(matches.map(match => match.matchedAlertName).filter(Boolean));
  const unmatchedFindings = uniqueFindings.map(finding => finding.alert_name).filter(name => !matchedAlertNames.has(name));

  return {
    uniqueAlertTypes, totalFindingInstances,
    truePositives, falseNegatives, matches, unmatchedFindings,
    detectionRate: webTruth.length ? (truePositives / webTruth.length) * 100 : null,
    falseNegativeRate: webTruth.length ? (falseNegatives / webTruth.length) * 100 : null,
  };
}

export function zapUrl(path, params = {}) {
  const url = new URL(`/JSON/${path}/`, config.security.zapUrl);
  url.search = new URLSearchParams({ apikey: config.security.zapApiKey || '', ...params }).toString();
  return url;
}