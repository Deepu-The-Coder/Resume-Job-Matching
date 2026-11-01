import {
  createJob as createJobService,
  listJobs,
  getJobById,
  serializeJob,
} from '../services/jobService.js';
import { findResumesForJob } from '../services/matchingService.js';
import { BadRequestError } from '../lib/errors.js';
import config from '../config.js';
import { parseInput } from '../middleware/validate.js';
import { jobBodySchema, tenantQuerySchema, idParamsSchema } from '../schemas/apiSchemas.js';

function matchingLimit(value) {
  if (value === undefined) return config.MATCHING_DEFAULT_K;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestError('k must be a positive integer');
  }
  return parsed;
}

export async function createJob(req, res, next) {
  try {
    const { title, description, requiredSkills } = parseInput(jobBodySchema, req.body);
    const { tenantId } = req;
    const postedBy = req.user?.sub;
    if (!title || !description || !postedBy) {
      throw new BadRequestError('title, description, and postedBy are required');
    }

    const job = await createJobService({
      title,
      description,
      requiredSkills,
      tenantId,
      postedBy,
      requestId: req.requestId,
    });

    res.status(201).json({ message: 'Job created and embedded successfully', job: serializeJob(job) });
  } catch (error) {
    next(error);
  }
}

export async function getJobs(req, res, next) {
  try {
    parseInput(tenantQuerySchema, req.query);
    const jobs = await listJobs({ tenantId: req.tenantId });
    res.status(200).json({ jobs: jobs.map(serializeJob) });
  } catch (error) {
    next(error);
  }
}

export async function getJob(req, res, next) {
  try {
    parseInput(idParamsSchema, req.params);
    parseInput(tenantQuerySchema, req.query);
    const job = await getJobById({ id: req.params.id, tenantId: req.tenantId });
    res.status(200).json({ job: serializeJob(job) });
  } catch (error) {
    next(error);
  }
}

export async function getJobMatches(req, res, next) {
  try {
    parseInput(idParamsSchema, req.params);
    const query = parseInput(tenantQuerySchema, req.query);
    const matches = await findResumesForJob(req.params.id, {
      tenantId: req.tenantId,
      k: matchingLimit(query.k),
      explain: query.explain === 'true',
      explainTop: query.explainTop === undefined ? config.EXPLANATION_DEFAULT_TOP : query.explainTop,
      requestId: req.requestId,
    });
    res.status(200).json({ matches });
  } catch (error) {
    next(error);
  }
}

export default { createJob, getJobs, getJob, getJobMatches };
