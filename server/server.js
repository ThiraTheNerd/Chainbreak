

import http from 'node:http';
import app from './app.js';
import config from './config/env.js';
import {testConnection as assertConnection} from './db/connection.js';
import initSocket from './socket/index.js';
import { startReaper } from './services/reaper.service.js';
import * as learnerSessions from './repositories/learner-session.repository.js';
import logger from './utils/logger.js';


async function start() {
  await assertConnection();

  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);
  startReaper(io);
  logger.info('Reaper started — sweeping every 60s');

  httpServer.listen(config.server.port, () => {
    logger.info(
      `ChainBreak server on http://localhost:${config.server.port} (${config.server.nodeEnv})`
    );
  });


  const shutdown = (signal) => {
    logger.info(`${signal} received — ending active learner sessions before exit`);
    learnerSessions.endAllActive('server_shutdown')
      .catch((err) => logger.error('Failed to end active learner sessions on shutdown', err))
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
 