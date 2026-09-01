export const PLATFORM = [
  'POST /api/auth/register',
  'POST /api/auth/login',
  'GET  /api/auth/me',
  'POST /api/auth/logout',
  'POST   /api/sessions/challenges/1/session',
  'DELETE /api/sessions/challenges/1/session',
  'GET    /api/challenges',
  'GET    /api/challenges/1',
  'GET    /api/challenges/1/progress',
  'GET    /api/challenges/1/solution-unlock',
  'POST   /api/challenges/1/solution-unlock',
  'GET    /api/challenges/1/hints',
  'POST   /api/challenges/1/start',
  'POST   /api/challenges',
  'DELETE /api/challenges/1',
  'POST /api/flags',
  'GET  /api/scores/me',
  'GET  /api/scores/leaderboard',
  'POST /api/assessment',
  'GET  /api/assessment/mine',
  'GET  /api/hints/research',
  'GET  /api/security/zap/status',
  'GET  /api/health',
];

export const CHALLENGE1 = [
  'POST /login',
  'GET  /api/users',
  'GET  /api/admin/backup?file=README.txt',
  'GET  /api/admin/backup?file=paymentsvc_key',
  'GET  /health',
];

export const CHALLENGE2 = [
  'GET  /',
  'GET  /login',
  'POST /login',
  'GET  /admin',
  'GET  /health',
];