import mongoose from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },
    tenantId: {
      type: String,
      required: [true, 'tenantId is required'],
      trim: true,
      index: true,
    },
    originalFilename: {
      type: String,
      required: [true, 'originalFilename is required'],
      trim: true,
    },
    parsedText: {
      type: String,
      required: [true, 'parsedText is required'],
    },
    contentHash: {
      type: String,
      required: [true, 'contentHash is required'],
      index: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    embedding: {
      type: [Number],
      default: [],
    },
    embeddingModel: {
      type: String,
      required: [true, 'embeddingModel is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for tenant-scoped lookups and deduplication
resumeSchema.index({ tenantId: 1, userId: 1 });
resumeSchema.index({ tenantId: 1, contentHash: 1 });
resumeSchema.index({ tenantId: 1, createdAt: -1 });
resumeSchema.plugin(tenantPlugin);

export const Resume = mongoose.model('Resume', resumeSchema);
export default Resume;
