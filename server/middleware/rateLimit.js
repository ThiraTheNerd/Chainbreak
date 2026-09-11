/** @file server/middleware/rateLimit.js — simple per-key sliding-window limiter.
 *
 * In-memory (single-process) — fine at this project's scale (see
 * docker.service.js / session.repository.js for the same assumption
 * elsewhere). Applied to the AI hint-reveal endpoint specifically, since
 * that's the one that costs both money (the Claude API call) and time
 * (network latency) per request — see server/routes/hints.js.
 */

const buckets = new Map(); // key -> timestamps[] (ms, within the current window)

export function rateLimit({ windowMs, max, keyFn = (req) => req.user?.id }) {
  return (req, res, next) => {
    const key = keyFn(req);
    if (key == null) return next(); // no identity to key on — let auth middleware handle rejection

    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const retryAfterSec = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: { message: 'Too many hint requests — please slow down and try again shortly.', status: 429 },
      });
    }

    recent.push(now);
    buckets.set(key, recent);
    next();
  };
}
