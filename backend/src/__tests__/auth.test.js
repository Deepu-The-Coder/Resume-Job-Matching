import { describe, expect, it } from 'vitest';
import { createToken, hashPassword, verifyPassword, verifyToken } from '../lib/auth.js';

describe('JWT authentication helpers', () => {
  it('hashes and verifies passwords and signs claims', () => {
    const passwordHash = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', passwordHash)).toBe(true);
    expect(verifyPassword('wrong password', passwordHash)).toBe(false);

    const token = createToken({
      _id: '507f1f77bcf86cd799439011',
      tenantId: 'tenant-a',
      role: 'candidate',
      name: 'Candidate',
    });
    expect(verifyToken(token)).toMatchObject({
      sub: '507f1f77bcf86cd799439011',
      tenantId: 'tenant-a',
      role: 'candidate',
    });
  });
});
