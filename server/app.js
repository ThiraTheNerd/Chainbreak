/** @file server/app.js — builds & configures Express WITHOUT listening (testable in-memory). */
 
import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
 
const app = express();
 
// app.use(cors({ origin: config.server.clientOrigin, credentials: true }));
// --- CORS must come BEFORE your routes ---
app.use(cors({
  origin: config.server.clientOrigin,        // e.g. 'http://localhost:5173'
  credentials: true,                  // allow cookies / Authorization headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
// Health check BEFORE the API router
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})
app.use('/api', routes);
 
// 404 catcher first, central error handler LAST.
app.use(notFound);
app.use(errorHandler);
 
export default app;
 