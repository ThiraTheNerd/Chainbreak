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

    workstationImage: process.env.WS_IMAGE         || 'chainbreak-workstation',
    memoryMb:         Number(process.env.DOCKER_MEM_MB)    || 256,
    nanoCpus:         Number(process.env.DOCKER_NANO_CPUS) || 500_000_000,
    pidsLimit:        Number(process.env.DOCKER_PIDS)      || 100,
    networkDriver:    process.env.DOCKER_NET_DRIVER        || 'bridge',
    ttlMinutes:       Number(process.env.SESSION_TTL_MIN)  || 60,

    localstackNetwork: process.env.LOCALSTACK_NETWORK || 'chainbreak-localstack-net',
  },
  security: {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
    zapUrl: process.env.ZAP_URL || 'http://zap:8080',
    zapApiKey: process.env.ZAP_API_KEY || null,
    zapTarget: process.env.ZAP_TARGET || 'http://nginx',
  },
  ai: {

    anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
    model:           process.env.ANTHROPIC_MODEL   || 'claude-sonnet-4-5',
  },
});

export default config;
