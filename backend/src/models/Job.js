import mongoose from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

const jobSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, 'tenantId is required'],
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'description is required'],
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    contentHash: {
      type: String,
      required: [true, 'contentHash is required'],
      index: true,
    },
    embedding: {
      type: [Number],
      default: [],
    },
    embeddingModel: {
      type: String,
      required: [true, 'embeddingModel is required'],
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'postedBy is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for tenant-scoped lookups
jobSchema.index({ tenantId: 1, postedBy: 1 });
jobSchema.index({ tenantId: 1, contentHash: 1 });
jobSchema.index({ tenantId: 1, createdAt: -1 });
jobSchema.plugin(tenantPlugin);

export const Job = mongoose.model('Job', jobSchema);
export default Job;
