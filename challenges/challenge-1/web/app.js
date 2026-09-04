import express  from 'express';
import Database from 'better-sqlite3';
import jwt      from 'jsonwebtoken';
import cors     from 'cors';
import fs       from 'node:fs';
import path     from 'node:path';

const app        = express();
const PORT       = process.env.PORT   || 3000;
// The literal defaults below only cover running this container standalone
// (outside ChainBreak) without docker.service.js's injected envs set. The
// docker-layer flag is not served here — it's a real SUID privesc (see
// entrypoint.sh / /root/flag.txt / /usr/local/bin/backup-helper), not an
// HTTP response field.
const FLAG_1       = process.env.FLAG_1  || 'flag{sqli_owasp_bypass}';
const FLAG_2A      = process.env.FLAG_2A || 'flag{sqli_broken_access}';
const JWT_SECRET   = 'challenge-1-not-a-real-secret';
const BACKUPS_DIR  = '/opt/payments/backups';

function verifyBearer(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

app.use(cors());
app.use(express.json());

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email    TEXT NOT NULL,
    password TEXT NOT NULL,
    role     TEXT NOT NULL DEFAULT 'user'
  );

  -- admin is inserted FIRST so LIMIT 1 returns admin when tautology matches all rows
  INSERT INTO users (username, email, password, role) VALUES
    ('admin', 'admin@acme.internal', 'Adm1n$up3r!', 'admin'),
    ('alice', 'alice@acme.internal', 'alice123',     'user'),
    ('bob',   'bob@acme.internal',   'bob456',       'user');
`);

// INTENTIONALLY VULNERABLE — OWASP A03:2021 SQL Injection
//
// Working payload: username=admin, password=anything' OR '1'='1
// Evaluates as: WHERE (username='admin' AND password='anything') OR ('1'='1')
// — always true, so every row matches; admin is first, so LIMIT 1 returns it.
app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body;

  // INTENTIONALLY VULNERABLE — string concatenation, not parameterisation
  const query = `SELECT * FROM users
                  WHERE username = '${username}'
                    AND password = '${password}'
                  LIMIT 1`;
  let user;
  try {
    user = db.prepare(query).get();
  } catch (err) {
    return res.status(500).json({
      error:           err.message,
      hint:            'SQL syntax error — check your injection string',
      query_attempted: query,
    });
  }
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const isAdmin = user.role === 'admin';
  return res.json({
    success:  true,
    message:  isAdmin
      ? '[+] Authentication bypassed via SQL injection'
      : `Welcome, ${user.username}`,
    username: user.username,
    role:     user.role,
    token,
    ...(isAdmin && { flag: FLAG_1 }),
  });
});

// INTENTIONALLY VULNERABLE — OWASP A01:2021 Broken Access Control
//
// Checks authentication (a valid JWT) but not authorization — there is no
// `claims.role === 'admin'` check, so any logged-in user can list every
// account.
app.get('/api/users', (req, res) => {
  const claims = verifyBearer(req);
  if (!claims) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const users = db.prepare(
    'SELECT id, username, email, role FROM users'
  ).all();
  res.json({
    users,
    flag: FLAG_2A,
    _links: { backups: '/api/admin/backup?file=README.txt' },
  });
});

// INTENTIONALLY VULNERABLE — do not fix. OWASP A01:2021 Broken Access
// Control + path traversal: the `file` query param is joined onto
// BACKUPS_DIR with no traversal sanitisation and no filename allowlist.
app.get('/api/admin/backup', (req, res) => {
  const claims = verifyBearer(req);
  if (!claims) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const file = req.query.file;
  if (!file) {
    return res.status(400).json({ error: 'file query param required' });
  }

  const target = path.join(BACKUPS_DIR, file);
  try {
    res.type('text/plain').send(fs.readFileSync(target, 'utf8'));
  } catch (err) {
    res.status(404).json({ error: `Cannot read file: ${err.message}` });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Challenge 1] Vulnerable app listening on port ${PORT}`);
  console.log(`[Challenge 1] Injection target: POST /login`);
  console.log(`[Challenge 1] Payload: password = anything' OR '1'='1`);
});
