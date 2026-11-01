import crypto from 'node:crypto';
import config from '../config.js';
import { BadRequestError } from './errors.js';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(input) {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(input).digest('base64url');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return expected.length === actual.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export function createToken(user) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: String(user._id),
    tenantId: user.tenantId,
    role: user.role,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + config.JWT_EXPIRES_IN_SECONDS,
  }));
  const input = `${header}.${payload}`;
  return `${input}.${sign(input)}`;
}

export function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new BadRequestError('Invalid authentication token');
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  if (signature.length !== expected.length
    || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new BadRequestError('Invalid authentication token');
  }
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!claims.sub || !claims.tenantId || !claims.role || claims.exp < Math.floor(Date.now() / 1000)) {
    throw new BadRequestError('Authentication token expired or invalid');
  }
  return claims;
}
