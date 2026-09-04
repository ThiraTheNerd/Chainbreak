/*
 * ChainBreak - Challenge 2 target
 *
 * Web-layer OWASP coverage (four distinct vulns on ONE app):
 *   A03  Software Supply Chain / Insecure Deserialisation -> node-serialize RCE (profile cookie)
 *   A10  Mishandling of Exceptional Conditions            -> verbose error leak
 *   A07  Authentication Failures                          -> weak, brute-forceable /login (no lockout)
 *   A04  Cryptographic Failures                           -> weak HS256 JWT secret -> forge admin token
 *
 * Container layer (outside this file): sudo-find misconfig -> root -> /root/flag.txt
 */
const express      = require('express');
const cookieParser = require('cookie-parser');
const serialize    = require('node-serialize');
const jwt          = require('jsonwebtoken');

// Secrets/flags are loaded into constants then scrubbed from process.env:
// otherwise a later RCE shell (same app user) could just run `env` and read
// every web flag at once, trivialising the challenge. Any shell the RCE
// spawns AFTER startup inherits the cleaned environment. Caveat:
// /proc/<pid>/environ still reflects the exec-time environment, so a
// determined RCE as the same user can still recover these — this scrub
// stops casual leakage, not a user who is already running as the process.
const FLAG_ERRORLEAK = process.env.FLAG_ERRORLEAK || 'flag{verbose_error_disclosure}';
const FLAG_WEAKAUTH  = process.env.FLAG_WEAKAUTH  || 'flag{weak_auth_no_lockout}';
const FLAG_JWTFORGE  = process.env.FLAG_JWTFORGE  || 'flag{jwt_secret_cracked}';
const JWT_SECRET     = process.env.JWT_SECRET     || 'insecure-dev-fallback';
delete process.env.FLAG_ERRORLEAK;
delete process.env.FLAG_WEAKAUTH;
delete process.env.FLAG_JWTFORGE;
delete process.env.JWT_SECRET;

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// A03: restores preferences from the profile cookie — the deserialisation
// RCE sink is intentional (INTENTIONALLY VULNERABLE, do not fix).
app.use((req, res, next) => {
  const cookie = req.cookies.profile;
  if (cookie) {
    try {
      const json = Buffer.from(cookie, 'base64').toString('utf8');
      req.profile = serialize.unserialize(json); // >>> RCE sink <<<
    } catch (err) {
      // A10: caught but INTENTIONALLY MISHANDLED — the raw stack trace
      // (naming node-serialize) plus a debug token are leaked to the client.
      return res
        .status(500)
        .type('html')
        .send(
          `<h1>Could not restore profile</h1>` +
          `<pre>${err.stack}</pre>` +
          `<!-- debug ref: ${FLAG_ERRORLEAK} -->`
        );
    }
  }
  next();
});

app.get('/', (req, res) => {
  if (!req.profile) {
    const seed = serialize.serialize({ user: 'guest', theme: 'light', role: 'viewer' });
    res.cookie('profile', Buffer.from(seed).toString('base64'), { httpOnly: false });
    return res.type('html').send(
      `<h1>ChainBreak Portal</h1>
       <p>Welcome, guest. Your default preferences have been saved to your
       <code>profile</code> cookie.</p>\n`
    );
  }
  res.type('html').send(
    `<h1>ChainBreak Portal</h1>
     <p>Welcome back, <b>${req.profile.user}</b>.
     Theme: ${req.profile.theme}, role: ${req.profile.role}.</p>\n`
  );
});

// A07: INTENTIONALLY VULNERABLE — one low-priv "support" account, weak
// password, no rate limiting or lockout, brute-forceable against a
// wordlist. A successful login returns a role=support JWT (not enough to
// reach /admin — see A04 below).
const USERS = {
  support: { password: 'support123', role: 'support' },
};

app.get('/login', (req, res) => {
  res.type('html').send(
    `<h1>Support Portal</h1>
     <form method="POST" action="/login">
       <input name="username" placeholder="username">
       <input name="password" type="password" placeholder="password">
       <button>Sign in</button>
     </form>
     <!-- internal note: support staff sign in with the standard 'support' account -->\n`
  );
});

app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = USERS[username];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { sub: username, role: user.role },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
  res.json({
    message: `Welcome, ${username}`,
    role:    user.role,
    token,
    flag:    FLAG_WEAKAUTH,
  });
});

// A04: INTENTIONALLY VULNERABLE — admin console gated on a signed admin
// JWT that the app never issues. The intended path is to crack the weak
// HS256 secret offline and forge one.
function verifyBearer(req) {
  const auth  = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  return jwt.verify(token, JWT_SECRET);
}

app.get('/admin', (req, res) => {
  let claims;
  try {
    claims = verifyBearer(req);
  } catch {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }
  if (claims.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' });
  }
  res.json({ message: 'Admin console', flag: FLAG_JWTFORGE });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`[target] listening on ${PORT}`));