import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

describe('tenant query plugin', () => {
  it('fails loudly when a query has no tenant scope', async () => {
    const schema = new mongoose.Schema({ tenantId: String });
    schema.plugin(tenantPlugin);
    const Model = mongoose.model(`TenantPlugin${Date.now()}`, schema);
    await expect(Model.find({}).exec()).rejects.toThrow('Tenant scope is required');
    await expect(Model.updateOne({}, { $set: { tenantId: 'x' } }).exec())
      .rejects.toThrow('Tenant scope is required');
  });
});
