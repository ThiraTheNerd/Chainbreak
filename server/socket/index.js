import { Server }  from 'socket.io';
import jwt         from 'jsonwebtoken';
import config      from '../config/env.js';
import { handleTerminal } from './terminal.js';
import * as sessions from '../repositories/session.repository.js';

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

    // Falls back to the session's single challenge if the client sends nothing.
    socket.challengeIds = Array.isArray(socket.handshake.auth?.challengeIds)
      ? socket.handshake.auth.challengeIds
      : [session.challenge_id]

    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] ${socket.user.username} connected (${socket.id})`);
    handleTerminal(socket, io);
    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user.username} disconnected`);
    });
  });

  return io;
}
