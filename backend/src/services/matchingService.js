import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { Resume } from '../models/Resume.js';
import { rankTopK } from './similarityService.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import logger from '../lib/logger.js';
import { scoped } from '../lib/tenantScope.js';
import { buildMatches, recordMatchingRequest } from './matchingResultsService.js';

function validateId(id, label) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError(`Invalid ${label} ID: "${id}"`);
  }
}

export async function findJobsForResume(resumeId, { tenantId, k, explain = false, explainTop = 3, requestId = 'unknown' }) {
  const requestStartedAt = performance.now();
  const retrievalStartedAt = performance.now();
  validateId(resumeId, 'resume');
  const resume = await scoped(Resume.findOne({ _id: resumeId, tenantId }), tenantId);
  if (!resume) {
    throw new NotFoundError(`Resume "${resumeId}" not found for this tenant`);
  }

  const jobs = await scoped(Job.find({ tenantId }), tenantId);
  const ranked = rankTopK(resume.embedding, jobs, k);
  const retrievalMs = Number((performance.now() - retrievalStartedAt).toFixed(2));
  const result = await buildMatches({ ranked, resume, tenantId, explain, explainTop, requestId, resumeFirst: true });
  const timing = await recordMatchingRequest({
    tenantId, requestId, querySummary: `resume:${resumeId} jobs:${ranked.length}`, requestStartedAt,
    retrievalMs, sources: result.sources, cacheLookupMs: result.cacheLookupMs, llmCallMs: result.llmCallMs,
  });
  logger.info({ tenantId, requestId, ...timing }, 'Match request stage timing');
  return result.matches;
}

export async function findResumesForJob(jobId, { tenantId, k, explain = false, explainTop = 3, requestId = 'unknown' }) {
  const requestStartedAt = performance.now();
  const retrievalStartedAt = performance.now();
  validateId(jobId, 'job');
  const job = await scoped(Job.findOne({ _id: jobId, tenantId }), tenantId);
  if (!job) {
    throw new NotFoundError(`Job "${jobId}" not found for this tenant`);
  }

  const resumes = await scoped(Resume.find({ tenantId }), tenantId);
  const ranked = rankTopK(job.embedding, resumes, k);
  const retrievalMs = Number((performance.now() - retrievalStartedAt).toFixed(2));
  const result = await buildMatches({ ranked, job, tenantId, explain, explainTop, requestId, resumeFirst: false });
  const timing = await recordMatchingRequest({
    tenantId, requestId, querySummary: `job:${jobId} resumes:${ranked.length}`, requestStartedAt,
    retrievalMs, sources: result.sources, cacheLookupMs: result.cacheLookupMs, llmCallMs: result.llmCallMs,
  });
  logger.info({ tenantId, requestId, ...timing }, 'Match request stage timing');
  return result.matches;
}

export default { findJobsForResume, findResumesForJob };
