import mongoose from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

const requestLogSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    requestId: { type: String, required: true, index: true },
    querySummary: { type: String, required: true },
    source: { type: String, enum: ['cache', 'llm', 'fallback', 'mixed', 'none'], required: true },
    latencyMs: { type: Number, required: true, min: 0 },
    retrievalMs: { type: Number, required: true, min: 0 },
    cacheLookupMs: { type: Number, required: true, min: 0 },
    llmCallMs: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

requestLogSchema.index({ tenantId: 1, createdAt: -1 });
requestLogSchema.plugin(tenantPlugin);

export const RequestLog = mongoose.model('RequestLog', requestLogSchema);
export default RequestLog;
