// In-memory sliding-window limiter — single-process, fine at this
// project's scale.

const buckets = new Map();

export function rateLimit({ windowMs, max, keyFn = (req) => req.user?.id }) {
  return (req, res, next) => {
    const key = keyFn(req);
    if (key == null) return next(); // let auth middleware handle rejection

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
