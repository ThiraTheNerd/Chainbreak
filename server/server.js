
/** @file server/server.js — boot: connect DB, share port with Socket.io, listen.
 *  Note (ESM): importing ./config/env.js runs dotenv BEFORE the db pool reads
 *  process.env, so no separate "load dotenv first" line is needed. */
 
import http from 'node:http';
import app from './app.js';
import config from './config/env.js';
import {testConnection as assertConnection} from './db/connection.js';
import initSocket from './socket/index.js';
import { startReaper } from './services/reaper.service.js';
import logger from './utils/logger.js';


async function start() {
  await assertConnection(); // fail fast if MySQL is unreachable

  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);
  startReaper(io);
  logger.info('Reaper started — sweeping every 60s');

  httpServer.listen(config.server.port, () => {
    logger.info(
      `ChainBreak server on http://localhost:${config.server.port} (${config.server.nodeEnv})`
    );
  });
}
 
start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
 