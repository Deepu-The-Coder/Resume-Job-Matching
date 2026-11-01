import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { embedText } from './embeddingService.js';
import config from '../config.js';
import logger from '../lib/logger.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { scoped } from '../lib/tenantScope.js';

function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function publicJob(job) {
  const value = typeof job.toObject === 'function' ? job.toObject() : { ...job };
  delete value.embedding;
  return value;
}

export async function createJob({ title, description, requiredSkills = [], tenantId, postedBy, requestId = 'unknown' }) {
  const content = `${title.trim()}\n${description.trim()}`;
  const contentHash = hashText(content);
  const existing = await scoped(Job.findOne({ contentHash, tenantId }), tenantId);

  if (existing) {
    logger.info({ tenantId, contentHash, jobId: existing._id }, 'Duplicate job content — returning cached document');
    return existing;
  }

  const embedding = await embedText(content, { tenantId, requestId });
  const job = await Job.create({
    title: title.trim(),
    description: description.trim(),
    requiredSkills,
    tenantId,
    postedBy: new mongoose.Types.ObjectId(postedBy),
    contentHash,
    embedding,
    embeddingModel: config.EMBEDDING_MODEL,
  });

  logger.info({ tenantId, jobId: job._id, vectorDim: embedding.length }, 'Job ingested successfully');
  return job;
}

export async function listJobs({ tenantId }) {
  return scoped(Job.find({ tenantId }), tenantId).select('-embedding');
}

export async function getJobById({ id, tenantId }) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError(`Invalid job ID: "${id}"`);
  }

  const job = await scoped(Job.findOne({ _id: id, tenantId }), tenantId).select('-embedding');
  if (!job) {
    throw new NotFoundError(`Job "${id}" not found for this tenant`);
  }
  return job;
}

export function serializeJob(job) {
  return publicJob(job);
}

export default { createJob, listJobs, getJobById, serializeJob };
