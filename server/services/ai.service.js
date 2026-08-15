import config from '../config/env.js';
import logger from '../utils/logger.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_TOKENS = 300;

const TIER_GUIDANCE = {
  1: 'a gentle CONCEPTUAL nudge — point them toward the right way of ' +
     'thinking about this vulnerability class, without naming a specific ' +
     'technique or command.',
  2: 'the TECHNIQUE or DIRECTION to pursue — name the class of attack or ' +
     'approach, but still no exact command, payload, or path.',
  3: 'NEAR-EXPLICIT guidance — the specific command, endpoint, or path to ' +
     'use, stopping just short of literally handing over the flag value ' +
     'itself.',
};

function buildPrompt({ challenge, context, tier }) {
  return [
    'You are an experienced penetration-testing mentor helping a learner ' +
    'on ChainBreak, a hands-on cybersecurity training platform. The ' +
    'learner is stuck on one specific flag and has requested a hint.',
    '',
    `CHALLENGE: ${challenge.title}`,
    `VULNERABILITY BEING EXPLOITED: ${context.vulnerability}`,
    'THE ACTUAL SOLUTION (reference only, so your hint stays accurate — ' +
      'do not reveal more of it than the requested tier allows, and NEVER ' +
      `output the literal flag string): ${context.solutionSummary}`,
    '',
    `Produce ONLY a TIER ${tier} hint (of 3 progressive tiers). A tier ` +
      `${tier} hint should give the learner ${TIER_GUIDANCE[tier]}`,
    '',
    'Rules: 2-4 sentences, plain text, no markdown headers or bullet ' +
      'points, no preamble like "Here\'s a hint:" or "Tier ' + tier + ':". ' +
      'Never include the literal flag string in any tier, and never ' +
      'reveal more of the solution than the requested tier allows.',
  ].join('\n');
}

async function callClaude(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.ai.anthropicApiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: config.ai.model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.content?.find((block) => block.type === 'text')?.text?.trim();
  if (!text) throw new Error('Anthropic API returned no text content');
  return text;
}

/**
 * Generates a tier-calibrated hint for a flag. Always resolves — never
 * throws — so a Claude outage can never break a live study session:
 *   - no hint context authored for this slug  -> generic honest fallback
 *   - no ANTHROPIC_API_KEY configured         -> the flag's tier fallback
 *   - the Claude call errors/times out        -> the flag's tier fallback
 *   - otherwise                               -> Claude's real response
 * `source` on the return value tells the caller (and, via
 * hint_unlocks.source, the research log) which of these happened.
 */
export async function generateHint({ challenge, context, tier }) {
  if (!context) {
    return {
      text: 'A tailored hint is not available for this flag yet — try ' +
        're-reading the challenge brief and exploring the target with ' +
        'the tools already in your workstation.',
      source: 'fallback',
    };
  }

  if (!config.ai.anthropicApiKey) {
    return { text: context.fallback[tier], source: 'fallback' };
  }

  try {
    const text = await callClaude(buildPrompt({ challenge, context, tier }));
    return { text, source: 'ai' };
  } catch (err) {
    logger.warn(`Claude hint generation failed for challenge ${challenge.id} tier ${tier}, using fallback: ${err.message}`);
    return { text: context.fallback[tier], source: 'fallback' };
  }
}
