import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
 
export function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}
 
// Express identifies this by its FOUR arguments — keep `next` even though unused.
export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) logger.error(err);
  else logger.warn(`${statusCode} ${err.message}`);
 
  res.status(statusCode).json({
    error: {
      message: err.isOperational ? err.message : 'Internal server error',
      status: statusCode,
    },
  });
}
 