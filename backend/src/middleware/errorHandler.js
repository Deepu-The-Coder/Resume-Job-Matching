import logger from '../lib/logger.js';
import { AppError, NotFoundError } from '../lib/errors.js';

/**
 * 404 handler for undefined routes.
 */
export function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}

/**
 * Centralized Express error-handling middleware returning consistent JSON.
 */
export function errorHandler(err, req, res, _next) {
  const reqLogger = req.log || logger;
  const requestId = req.requestId || req.id || 'unknown';

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details = null;

  // Handle known application errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }
  // Handle plain errors that carry statusCode/code (e.g. from multer, pdfParser, embeddings)
  else if (err.statusCode && err.code) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
  }
  // Handle JSON parse errors from body-parser
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON in request body';
  }
  // Handle Mongoose Validation Errors
  else if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Database validation failed';
    details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }
  // Handle Mongoose CastError (e.g. invalid ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid value '${err.value}' for field '${err.path}'`;
  }

  // Log error with request context
  if (statusCode >= 500) {
    reqLogger.error(
      {
        err: {
          message: err.message,
          stack: err.stack,
          code,
        },
        statusCode,
      },
      `Unhandled server error: ${message}`
    );
  } else {
    reqLogger.warn(
      {
        err: {
          message,
          code,
        },
        statusCode,
      },
      `Client error (${statusCode}): ${message}`
    );
  }

  res.status(statusCode).json({
    error: {
      message,
      code,
      details,
    },
    requestId,
  });
}

export default errorHandler;
