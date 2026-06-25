/** @file server/utils/errors.js — operational error hierarchy; each carries an HTTP statusCode. */
 
export class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message, options);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
 
export class BadRequestError extends AppError {
  constructor(message = 'Bad request') { super(message, 400); }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401); }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403); }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found') { super(message, 404); }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflict') { super(message, 409); }
}
export class ValidationError extends AppError {
  constructor(message = 'Validation error') { super(message, 400); }
}
 