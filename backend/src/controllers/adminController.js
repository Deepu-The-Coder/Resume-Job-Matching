import {
  queueBulkEmbed,
  queueBulkMatch,
  getJobStatus,
  getFailedJobs,
} from '../services/adminJobService.js';
import { parseInput } from '../middleware/validate.js';
import { bulkEmbedSchema, bulkMatchSchema, queueJobParamsSchema } from '../schemas/apiSchemas.js';

export async function bulkEmbed(req, res, next) {
  try {
    const { type, ids } = parseInput(bulkEmbedSchema, req.body);
    const { tenantId } = req;
    const jobId = await queueBulkEmbed({ tenantId, type, ids });
    res.status(202).json({ jobId, status: 'queued' });
  } catch (error) {
    next(error);
  }
}

export async function bulkMatch(req, res, next) {
  try {
    const { jobId, k } = parseInput(bulkMatchSchema, req.body);
    const { tenantId } = req;
    const queueJobId = await queueBulkMatch({ tenantId, jobId, k });
    res.status(202).json({ jobId: queueJobId, status: 'queued' });
  } catch (error) {
    next(error);
  }
}

export async function jobStatus(req, res, next) {
  try {
    parseInput(queueJobParamsSchema, req.params);
    res.status(200).json(await getJobStatus(req.params.jobId, req.tenantId));
  } catch (error) {
    next(error);
  }
}

export async function failedJobs(req, res, next) {
  try {
    res.status(200).json({ jobs: await getFailedJobs(req.tenantId) });
  } catch (error) {
    next(error);
  }
}

export default { bulkEmbed, bulkMatch, jobStatus, failedJobs };
