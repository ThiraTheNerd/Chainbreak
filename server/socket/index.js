import { Server }       from 'socket.io';
import jwt              from 'jsonwebtoken';
import { randomUUID }   from 'node:crypto';
import config           from '../config/env.js';
import { handleTerminal } from './terminal.js';
import * as sessions        from '../repositories/session.repository.js';
import * as learnerSessions from '../repositories/learner-session.repository.js';
import logger from '../utils/logger.js';

export default function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin:  config.server.clientOrigin,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('Authentication required'));

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch {
      return next(new Error('Invalid token'));
    }

    socket.user = { id: decoded.sub, username: decoded.username, role: decoded.role };

    const sessionId = socket.handshake.auth?.sessionId;
    if (!sessionId) return next(new Error('sessionId required'));

    const session = await sessions.findById(sessionId).catch(() => null);

    if (!session || session.user_id !== decoded.sub || session.status !== 'running') {
      return next(new Error('Session not accessible'));
    }

    socket.session = session;

    // A `learner_sessions` row is the "a learner actually engaged" signal,
    // deliberately separate from the `sessions` (environment/Docker
    // lifecycle) row above — created here, at the point the server has
    // verified an authenticated, owned, running-environment Socket.IO
    // connection, per the target architecture. One row per ACCEPTED
    // connection (not per environment run): this terminal bridge spawns an
    // independent PTY per connection with no shared-terminal/reconnect-
    // attach logic, so that is what actually matches runtime behavior.
    //
    // Note: this handshake previously also accepted a client-supplied
    // `challengeIds` array and trusted it directly for flag scoring. That
    // field is no longer read here or anywhere server-side — scoring now
    // reconstructs the authoritative challenge set itself from
    // `socket.session.challenge_id` (see flag.service.js::submitFlagForSession).
    // The client may still send it; it is simply ignored.
    const learnerSession = await learnerSessions.create({
      id: randomUUID(),
      environmentSessionId: session.id,
      userId: decoded.sub,
    });
    socket.learnerSessionId = learnerSession.id;

    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] ${socket.user.username} connected (${socket.id})`);
    // Named after the environment session, not the learner session, so the
    // reaper's `io.in(\`session:${id}\`)` can force-disconnect every
    // connection attached to an expiring environment in one call.
    socket.join(`session:${socket.session.id}`);
    handleTerminal(socket, io);
    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user.username} disconnected`);
      learnerSessions.end(socket.learnerSessionId, 'disconnect').catch((err) =>
        logger.error(`[Socket] failed to end learner session ${socket.learnerSessionId}`, err)
      );
    });
  });

  return io;
}
