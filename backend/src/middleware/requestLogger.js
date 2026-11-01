import logger from '../lib/logger.js';

/**
 * Middleware that attaches a request-scoped child logger and logs HTTP request metrics upon completion.
 */
export function requestLoggerMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();

  // Attach child logger carrying requestId and tenantId (if present)
  const childBindings = {
    requestId: req.requestId || req.id,
  };

  if (req.tenantId) {
    childBindings.tenantId = req.tenantId;
  }

  req.log = logger.child(childBindings);

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;

    req.log.info({
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      tenantId: req.tenantId || undefined,
      msg: `${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs.toFixed(2)}ms`,
    });
  });

  next();
}

export default requestLoggerMiddleware;
