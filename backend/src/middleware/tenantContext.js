import { BadRequestError } from '../lib/errors.js';

export function tenantContextMiddleware(req, _res, next) {
  if (!['/resumes', '/jobs', '/admin', '/stats'].some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    return next();
  }
  const tenantId = req.user?.tenantId;

  if (!tenantId || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(tenantId)) {
    return next(new BadRequestError('x-tenant-id is required unless supplied by authenticated tenant context'));
  }

  req.tenantId = tenantId;
  return next();
}

export default tenantContextMiddleware;
