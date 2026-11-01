import { User } from '../models/User.js';
import { scoped } from '../lib/tenantScope.js';
import { hashPassword, verifyPassword, createToken } from '../lib/auth.js';
import { BadRequestError, UnauthorizedError } from '../lib/errors.js';

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  };
}

export async function register({ name, email, password, role, tenantId }) {
  const existing = await scoped(User.findOne({ email: email.toLowerCase(), tenantId }), tenantId);
  if (existing) throw new BadRequestError('An account with this email already exists for this tenant');
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    role,
    tenantId,
  });
  return { token: createToken(user), user: publicUser(user) };
}

export async function login({ email, password, tenantId }) {
  const user = await scoped(
    User.findOne({ email: email.toLowerCase(), tenantId }).select('+passwordHash'),
    tenantId
  );
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new UnauthorizedError('Invalid email, password, or tenant');
  }
  return { token: createToken(user), user: publicUser(user) };
}
