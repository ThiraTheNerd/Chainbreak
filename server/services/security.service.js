import crypto from 'node:crypto';
import config from '../config/env.js';
import * as repository from '../repositories/security.repository.js';
import { calculateScore, evaluateFindings, mapAlert, normaliseRisk, OWASP_CATEGORIES, GROUND_TRUTH, validateTarget, zapUrl } from '../lib/securityCentre.js';
import { ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { PLATFORM, CHALLENGE1, CHALLENGE2 } from '../data/ground-truth-routes.js';

const ALLOWED_TYPES = new Set(['passive', 'full', 'api']);
const SPIDER_TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVE_SCAN_TIMEOUT_MS = 30 * 60 * 1000;


async function zapRequest(path, params = {}) {

    // console.log('[scan] key:', Boolean(config.security?.zapApiKey),
    //     'len:', config.security?.zapApiKey?.length,
    //     'url:', config.security?.zapUrl,
    //     'target:', config.security?.zapTarget);
  if (!config.security.zapApiKey) throw new Error('ZAP_API_KEY is not configured');
  let response;
  try {
    response = await fetch(zapUrl(path, params));
  } catch (error) {
    const code = error.cause?.code || error.code;
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      throw new Error(
        `ZAP became unreachable at ${config.security.zapUrl} during the scan — the container may have crashed or run out of memory`,
        { cause: error }
      );
    }
    throw error;
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ZAP returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  const body = await response.json();
  if (body.code && body.code !== 'OK') throw new Error(body.message || 'ZAP API request failed');
  return body;
}

function counts(findings) {
  return findings.reduce((result, finding) => { result[finding.risk] = (result[finding.risk] || 0) + 1; return result; }, {});
}
// Add near the other helpers in security.service.js

async function configureAuthHeader(token) {
  if (!token) return;
  // Remove any prior rule so re-runs don't stack duplicates
  try {
    await zapRequest('replacer/action/removeRule', { description: 'chainbreak-auth' });
  } catch { /* no existing rule — fine */ }
  await zapRequest('replacer/action/addRule', {
    description: 'chainbreak-auth',
    enabled: 'true',
    matchType: 'REQ_HEADER',
    matchRegex: 'false',
    matchString: 'Authorization',
    replacement: `Bearer ${token}`,
    initiators: '',
  });
  logger.info('[security.service] auth header configured for scan');
}

function normaliseAlert(scanId, alert) {
  const risk = normaliseRisk(alert.risk);
  const alertName = alert.alert || alert.name || 'Unnamed alert';
  const mapping = mapAlert(alertName);
  if (mapping.owaspMapping === 'not_mapped') console.warn(`[security.service] no OWASP mapping for alert "${alertName}"`);
  return {
    scan_id: scanId, alert_name: alertName, risk,
    confidence: alert.confidence || null, url: alert.url || '', method: alert.method || null,
    parameter: alert.param || null, evidence: alert.evidence || null, description: alert.description || null,
    solution: alert.solution || null, reference_url: alert.reference || null,
    owasp_category: mapping.owaspCategory, owasp_mapping: mapping.owaspMapping,
    layer: 'web', challenge: null, ground_truth_status: 'unassessed',
  };
}

function routesForTarget(target) {
  const hostname = new URL(target).hostname;
  if (hostname === 'nginx') return PLATFORM;
  if (hostname === 'web-challenge-1') return CHALLENGE1;
  if (hostname === 'web-challenge-2') return CHALLENGE2;
  return [];
}

// Primes ZAP's site tree with known routes for this specific target — including
// API endpoints that aren't reachable via link-following — before spidering.
async function seedKnownRoutes(scanId, target) {
  const routes = routesForTarget(target);
  for (const route of routes) {
    const path = route.trim().split(/\s+/).pop();
    try {
      await zapRequest('core/action/accessUrl', { url: `${target}${path}` });
    } catch (error) {
      logger.warn(`[security.service] failed to seed route "${route}" for scan ${scanId}`, error);
    }
  }
  logger.info(`[security.service] seeded ${routes.length} known route(s) for scan ${scanId} (${target})`);
}

async function runAjaxSpider(scanId, target) {
  await zapRequest('ajaxSpider/action/scan', { url: target, inScope: 'true', contextName: 'chainbreak' });
  const deadline = Date.now() + SPIDER_TIMEOUT_MS;
  let ajaxStatus = 'running';
  while (ajaxStatus !== 'stopped') {
    if (Date.now() > deadline) throw new Error('AJAX spider timed out after 10 minutes');
    await new Promise(resolve => setTimeout(resolve, 1000));
    ajaxStatus = (await zapRequest('ajaxSpider/view/status')).status;
    await repository.updateScan(scanId, { current_phase: `AJAX spider (${ajaxStatus})` });
  }
  const { numberOfResults } = await zapRequest('ajaxSpider/view/numberOfResults');
  logger.info(`[security.service] AJAX spider found ${numberOfResults} URL(s) for scan ${scanId}`);
}

async function runScan(scanId, scanType, target, authToken) {
  try {
    logger.info(`[security.service] scan ${scanId} starting against target ${target}`);
    await repository.updateScan(scanId, { status: 'scanning', current_phase: scanType === 'passive' ? 'Passive analysis' : 'Spider' });
    // 1. Safely handle newSession conflicts
    try {
      await zapRequest('core/action/newSession', { name: `chainbreak-${scanId}`, overwrite: 'true' });
    } catch (err) {
      if (!err.message?.includes('already_exists')) throw err;
    }
    // A context is required for the AJAX spider's inScope check below, and will
    // also be needed later for authenticated scanning.
    // 2. Safely handle Context creation
    const contexts = await zapRequest('context/view/contextList');
    if (!String(contexts.contextList || '').includes('chainbreak')) {
      try {
        await zapRequest('context/action/newContext', { contextName: 'chainbreak' });
      } catch (err) {
        if (!err.message?.includes('already_exists')) throw err;
      }
    }
    // 3. Safely handle includeInContext conflicts
    try {
      await zapRequest('context/action/includeInContext', { contextName: 'chainbreak', regex: `${target}.*` });
    } catch (err) {
      if (!err.message?.includes('already_exists')) throw err;
    }
    // inside runScan, after the includeInContext block, before spider/action/scan:
    if (authToken) await configureAuthHeader(authToken);
    await seedKnownRoutes(scanId, target);
    // maxChildren: 0 means unlimited children per node.
    const spider = await zapRequest('spider/action/scan', { url: target, maxChildren: 0, recurse: 'true' });
    const spiderId = spider.scan;
    let spiderStatus = '0';
    const spiderDeadline = Date.now() + SPIDER_TIMEOUT_MS;
    while (spiderStatus !== '100') {
      if (Date.now() > spiderDeadline) throw new Error('Traditional spider timed out after 10 minutes');
      await new Promise(resolve => setTimeout(resolve, 1000));
      spiderStatus = String((await zapRequest('spider/view/status', { scanId: spiderId })).status || '100');
      await repository.updateScan(scanId, { current_phase: `Spider (${spiderStatus}%)` });
    }
    const spiderResults = await zapRequest('spider/view/results', { scanId: spiderId });
    logger.info(`[security.service] traditional spider found ${(spiderResults.results || []).length} URL(s) for scan ${scanId}`);
    // AJAX spider drives a headless browser and executes JS, so it can discover
    // routes in the React SPA that the traditional link-following spider misses.
    // The two are complementary and both feed the same ZAP site tree.
    // try {
    //   logger.info(`[security.service] Starting AJAX spider for scan ${scanId}...`);
    //   // await runAjaxSpider(scanId, target);
    // } catch (ajaxError) {
    //   logger.warn(`[security.service] AJAX spider failed or container OOMed for scan ${scanId}, skipping to Active Scan:`, ajaxError.message);
    //   await repository.updateScan(scanId, { current_phase: 'AJAX spider (skipped/failed)' });
    // }
    // Total site-tree URLs, not just ones that produced an alert — the correct
    // signal for "did the scanner ever reach the target" (see endpointsFound below).
    let urlsDiscovered;
    try {
      const siteUrls = await zapRequest('core/view/urls', { baseurl: target });
      urlsDiscovered = (siteUrls.urls || []).length;
    } catch (error) {
      logger.warn(`[security.service] core/view/urls failed for scan ${scanId}, falling back to spider results count`, error);
      urlsDiscovered = (spiderResults.results || []).length;
    }
    if (scanType !== 'passive') {
      const active = await zapRequest('ascan/action/scan', { url: target, recurse: 'true', inScopeOnly: 'true' });
      let activeStatus = '0';
      const activeDeadline = Date.now() + ACTIVE_SCAN_TIMEOUT_MS;
      while (activeStatus !== '100') {
        if (Date.now() > activeDeadline) throw new Error('Active scan timed out after 30 minutes');
        await new Promise(resolve => setTimeout(resolve, 1000));
        activeStatus = String((await zapRequest('ascan/view/status', { scanId: active.scan })).status || '100');
        await repository.updateScan(scanId, { current_phase: `Active scan (${activeStatus}%)` });
      }
    }
    const alerts = (await zapRequest('core/view/alerts', { baseurl: target, count: 10000 })).alerts || [];
    const findings = alerts.map(alert => normaliseAlert(scanId, alert));
    const severity = counts(findings);
    const endpointsFound = new Set(findings.map(finding => finding.url)).size;
    const { numberOfMessages } = await zapRequest('core/view/numberOfMessages', { baseurl: target });
    const requestsMade = Number(numberOfMessages) || 0;
    logger.info(`[security.service] scan ${scanId}: urls_discovered=${urlsDiscovered} requests_made=${requestsMade}`);
    await repository.insertFindings(findings);
    await repository.updateScan(scanId, {
      status: 'completed', completed_at: new Date(),
      current_phase: urlsDiscovered === 0 ? 'Complete (no endpoints discovered)' : 'Complete',
      total_findings: findings.length, critical_count: severity.critical || 0, high_count: severity.high || 0,
      medium_count: severity.medium || 0, low_count: severity.low || 0, informational_count: severity.informational || 0,
      score: calculateScore(severity, urlsDiscovered), endpoints_found: endpointsFound, urls_discovered: urlsDiscovered,
      requests_made: requestsMade,
    });
  } catch (error) {
    logger.error(`[security.service] scan ${scanId} failed`, error, { code: error.code, sqlMessage: error.sqlMessage });
    await repository.updateScan(scanId, { status: 'failed', completed_at: new Date(), current_phase: 'Failed', error_message: error.message });
  }
}

export async function startScan({ target, scanType, authToken }) {
  if (!ALLOWED_TYPES.has(scanType)) throw new ValidationError('scanType must be passive, full, or api');
  if (!validateTarget(target)) throw new ValidationError('Target must be one of the controlled ChainBreak scan targets');
  const scan = await repository.createScan({ id: crypto.randomUUID(), target, scanType });
  void runScan(scan.id, scanType, target, authToken);
  return scan;
}

export async function getScan(id) { return repository.getScan(id); }
export async function listScans() { return repository.listScans(); }
export async function getFindings(id) { return repository.getFindings(id); }
export function metadata() { return { owasp: OWASP_CATEGORIES, groundTruth: GROUND_TRUTH, limitations: { web: 'ZAP assesses HTTP application behaviour.', container: 'Not assessed by ZAP; use Docker inspection and exploitation evidence.', cloud: 'Not assessed by ZAP; use LocalStack/AWS inspection evidence.' } }; }
export async function evaluation(id) { return evaluateFindings(await repository.getFindings(id)); }