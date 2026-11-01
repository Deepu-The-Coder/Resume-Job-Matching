import mongoose from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

const matchSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, 'tenantId is required'],
      trim: true,
      index: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: [true, 'resumeId is required'],
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'jobId is required'],
      index: true,
    },
    similarityScore: {
      type: Number,
      required: [true, 'similarityScore is required'],
      min: [0, 'similarityScore cannot be less than 0'],
      max: [1, 'similarityScore cannot be greater than 1'],
    },
    explanation: {
      type: String,
      default: null,
    },
    explanationSource: {
      type: String,
      enum: {
        values: ['llm', 'cache', 'fallback', null],
        message: '{VALUE} is not a valid explanation source',
      },
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes: unique pair per tenant, plus score ranking lookups
matchSchema.index({ tenantId: 1, resumeId: 1, jobId: 1 }, { unique: true });
matchSchema.index({ tenantId: 1, resumeId: 1, similarityScore: -1 });
matchSchema.index({ tenantId: 1, jobId: 1, similarityScore: -1 });
matchSchema.plugin(tenantPlugin);

export const Match = mongoose.model('Match', matchSchema);
export default Match;
