import crypto from 'node:crypto';

/**
 * Attaches a unique request ID (X-Request-Id) to each request and response.
 */
export function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim()
      ? incomingId.trim()
      : crypto.randomUUID();

  req.id = requestId;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

export default requestIdMiddleware;
