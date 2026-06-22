import 'dotenv/config';

const required = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
const missing  = required.filter(k => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}`);
}

const config = Object.freeze({
  server: {
    port:         Number(process.env.PORT) || 3000,
    nodeEnv:      process.env.NODE_ENV    || 'development',
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  },
  db: {
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port:     Number(process.env.DB_PORT) || 3306,
  },
  jwt: {
    secret:    process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  aws: {
    endpoint: process.env.LOCALSTACK_URL || 'http://localstack:4566',
    region:   process.env.AWS_REGION     || 'us-east-1',
  },
  docker: {
    socketPath:       process.env.DOCKER_SOCKET    || '/var/run/docker.sock',
    // Built from server/docker/workstation/Dockerfile (has openssh-client +
    // john/ssh2john + a wordlist, and a real `sleep infinity` keep-alive) —
    // build it with `docker compose build workstation` (see docker-compose.yml;
    // it's gated behind a `build-only` profile so a bare `up`/`build` skips
    // it). Plain 'node:20-alpine' has none of that — still overridable via
    // WS_IMAGE for anyone who hasn't built the image yet.
    workstationImage: process.env.WS_IMAGE         || 'chainbreak-workstation',
    memoryMb:         Number(process.env.DOCKER_MEM_MB)    || 256,
    nanoCpus:         Number(process.env.DOCKER_NANO_CPUS) || 500_000_000,
    pidsLimit:        Number(process.env.DOCKER_PIDS)      || 100,
    networkDriver:    process.env.DOCKER_NET_DRIVER        || 'bridge',
    ttlMinutes:       Number(process.env.SESSION_TTL_MIN)  || 60,
    // The stable, explicit name given to docker-compose.yml's `localstack-net`
    // network (via its `name:` field) — NOT compose's auto-generated
    // `<project>_localstack-net`, which would silently change if the compose
    // project name ever changes (a different clone directory, a custom -p
    // flag, COMPOSE_PROJECT_NAME). provision() below connects each session's
    // workstation to this network post-create so `aws --endpoint-url=...`
    // can resolve `localstack` from inside it — cloud-layer STAGE 1 plumbing.
    localstackNetwork: process.env.LOCALSTACK_NETWORK || 'chainbreak-localstack-net',
  },
  security: {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
    zapUrl: process.env.ZAP_URL || 'http://zap:8080',
    zapApiKey: process.env.ZAP_API_KEY || null,
    zapTarget: process.env.ZAP_TARGET || 'http://nginx',
  },
  ai: {
    // Server-side only — never sent to the client. Deliberately NOT in the
    // `required` list above: the hint system must keep working (via its
    // pre-written fallback, see server/lib/hintContext.js) even when no key
    // is configured, so a missing key degrades gracefully instead of
    // crashing the whole server on boot.
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
    model:           process.env.ANTHROPIC_MODEL   || 'claude-sonnet-4-5',
  },
});

export default config;
