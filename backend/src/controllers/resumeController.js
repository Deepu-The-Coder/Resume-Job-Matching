import { handleUpload, sanitizeFilename } from '../middleware/upload.js';
import { uploadResume, getResumeById } from '../services/resumeService.js';
import { findJobsForResume } from '../services/matchingService.js';
import config from '../config.js';
import { BadRequestError } from '../lib/errors.js';
import { parseInput } from '../middleware/validate.js';
import { resumeBodySchema, tenantQuerySchema, idParamsSchema } from '../schemas/apiSchemas.js';

/**
 * POST /api/resumes
 * Accepts a PDF upload; identity comes from the JWT.
 */
export async function createResume(req, res, next) {
  try {
    await handleUpload(req, res);
    parseInput(resumeBodySchema, req.body);

    const { tenantId } = req;

    if (!tenantId || !req.user?.sub || (config.NODE_ENV === 'test' && !req.body?.userId)) {
      throw new BadRequestError('Authenticated user and tenant context are required');
    }

    if (!req.file) {
      throw new BadRequestError('No PDF file was uploaded. Use field name "resume"');
    }

    const resume = await uploadResume({
      buffer: req.file.buffer,
      originalname: sanitizeFilename(req.file.originalname),
      userId: req.user.sub,
      tenantId,
      requestId: req.requestId,
    });

    res.status(201).json({
      message: 'Resume uploaded and embedded successfully',
      resume: {
        _id: resume._id,
        tenantId: resume.tenantId,
        userId: resume.userId,
        originalFilename: resume.originalFilename,
        skills: resume.skills,
        contentHash: resume.contentHash,
        embeddingModel: resume.embeddingModel,
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/resumes/:id
 * Returns a resume by ID for the tenant in the request context.
 * Embedding array is excluded from the response.
 */
export async function getResume(req, res, next) {
  try {
    const { id } = req.params;
    const { tenantId } = req;
    parseInput(idParamsSchema, req.params);
    parseInput(tenantQuerySchema, req.query);

    const resume = await getResumeById({ id, tenantId });

    res.status(200).json({ resume });
  } catch (err) {
    next(err);
  }
}

export async function getResumeMatches(req, res, next) {
  try {
    const { tenantId } = req;
    parseInput(idParamsSchema, req.params);
    const query = parseInput(tenantQuerySchema, req.query);
    const rawLimit = query.k;
    const k = rawLimit === undefined ? config.MATCHING_DEFAULT_K : Number(rawLimit);
    if (!Number.isInteger(k) || k < 1) {
      throw new BadRequestError('k must be a positive integer');
    }

    const explain = query.explain === 'true';
    const rawExplainTop = query.explainTop;
    const explainTop = rawExplainTop === undefined
      ? config.EXPLANATION_DEFAULT_TOP
      : Number(rawExplainTop);
    if (!Number.isInteger(explainTop) || explainTop < 1) {
      throw new BadRequestError('explainTop must be a positive integer');
    }

    const matches = await findJobsForResume(req.params.id, {
      tenantId,
      k,
      explain,
      explainTop,
      requestId: req.requestId,
    });
    res.status(200).json({ matches });
  } catch (err) {
    next(err);
  }
}

export default { createResume, getResume, getResumeMatches };
