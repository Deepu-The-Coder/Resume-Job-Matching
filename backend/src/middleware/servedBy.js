import os from 'node:os';

const servedBy = process.env.HOSTNAME || os.hostname();

export function servedByMiddleware(_req, res, next) {
  res.setHeader('X-Served-By', servedBy);
  next();
}

export default servedByMiddleware;
