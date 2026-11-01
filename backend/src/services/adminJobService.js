import config from '../config.js';
import {
  enqueueBulkEmbed,
  enqueueBulkMatch,
  getQueueJob,
  listFailedQueueJobs,
} from '../queues/embeddingQueue.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';

function ids(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1000) {
    throw new BadRequestError('ids must be a non-empty array with at most 1000 items');
  }
  return value;
}

export async function queueBulkEmbed({ tenantId, type, ids: requestedIds }) {
  if (!tenantId || !['resume', 'job'].includes(type)) {
    throw new BadRequestError('tenantId and type ("resume" or "job") are required');
  }
  return enqueueBulkEmbed({ tenantId, type, ids: ids(requestedIds) });
}

export async function queueBulkMatch({ tenantId, jobId, k }) {
  if (!tenantId || !jobId) {
    throw new BadRequestError('tenantId and jobId are required');
  }
  const limit = k === undefined ? config.MATCHING_DEFAULT_K : Number(k);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new BadRequestError('k must be a positive integer');
  }
  return enqueueBulkMatch({ tenantId, jobId, k: limit });
}

function parseFailures(job) {
  if (!job?.failedReason) return [];
  try {
    const parsed = JSON.parse(job.failedReason);
    return Array.isArray(parsed.failures) ? parsed.failures : [{ message: job.failedReason }];
  } catch {
    return [{ message: job.failedReason }];
  }
}

export async function getJobStatus(jobId, tenantId) {
  const job = await getQueueJob(jobId);
  if (!job) throw new NotFoundError(`Background job "${jobId}" not found`);
  if (job.data?.tenantId !== tenantId) throw new NotFoundError(`Background job "${jobId}" not found`);
  const state = await job.getState();
  const progress = typeof job.progress === 'number' ? job.progress : 0;
  return {
    jobId: job.id,
    type: job.name,
    status: state,
    progress,
    failures: parseFailures(job),
    attemptsMade: job.attemptsMade,
  };
}

export async function getFailedJobs(tenantId) {
  const jobs = await listFailedQueueJobs();
  return jobs.filter((job) => job.data?.tenantId === tenantId).map((job) => ({
    jobId: job.id,
    type: job.name,
    status: 'failed',
    progress: typeof job.progress === 'number' ? job.progress : 0,
    failures: parseFailures(job),
    attemptsMade: job.attemptsMade,
    failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
  }));
}

export default { queueBulkEmbed, queueBulkMatch, getJobStatus, getFailedJobs };
