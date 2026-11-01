import mongoose from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

const usageLogSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    type: { type: String, enum: ['embedding', 'llm'], required: true },
    source: {
      type: String,
      enum: ['embedding', 'llm', 'cache', 'cache-miss', 'fallback'],
      required: true,
      index: true,
    },
    cacheLevel: { type: String, enum: ['exact', 'semantic', null], default: null },
    tokensIn: { type: Number, default: 0, min: 0 },
    tokensOut: { type: Number, default: 0, min: 0 },
    estimatedCost: { type: Number, default: 0, min: 0 },
    estimatedCostSaved: { type: Number, default: 0, min: 0 },
    latencyMs: { type: Number, required: true, min: 0 },
    requestId: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

usageLogSchema.index({ tenantId: 1, createdAt: -1 });
usageLogSchema.plugin(tenantPlugin);

export const UsageLog = mongoose.model('UsageLog', usageLogSchema);
export default UsageLog;
