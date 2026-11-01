import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Resume } from '../models/Resume.js';
import { parsePdf } from '../lib/pdfParser.js';
import { extractSkills } from '../lib/skillExtractor.js';
import { embedText } from './embeddingService.js';
import config from '../config.js';
import logger from '../lib/logger.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { scoped } from '../lib/tenantScope.js';

/**
 * Compute a SHA-256 hash of content to detect duplicates cheaply.
 *
 * @param {string} text
 * @returns {string} hex digest
 */
function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Upload and ingest a resume PDF:
 *  1. Parse PDF text
 *  2. Reject empty/unreadable PDFs
 *  3. Extract skills via keyword matching
 *  4. Hash content — return existing document if duplicate
 *  5. Generate embedding
 *  6. Persist and return the Resume document
 *
 * @param {{ buffer: Buffer, originalname: string, userId: string, tenantId: string }} params
 * @returns {Promise<import('../models/Resume.js').Resume>}
 */
export async function uploadResume({ buffer, originalname, userId, tenantId, requestId = 'unknown' }) {
  // --- Parse PDF ---
  const parsedText = await parsePdf(buffer, originalname);

  // --- Extract skills ---
  const skills = await extractSkills(parsedText);

  // --- Content deduplication ---
  const contentHash = hashText(parsedText);
  const existing = await scoped(Resume.findOne({ contentHash, tenantId }), tenantId);

  if (existing) {
    logger.info(
      { tenantId, contentHash, resumeId: existing._id },
      'Duplicate resume content — returning cached document'
    );
    return existing;
  }

  // --- Generate embedding ---
  const embedding = await embedText(parsedText, { tenantId, requestId });
  const embeddingModel = config.EMBEDDING_MODEL;

  // --- Persist ---
  const resume = await Resume.create({
    userId: new mongoose.Types.ObjectId(userId),
    tenantId,
    originalFilename: originalname,
    parsedText,
    contentHash,
    skills,
    embedding,
    embeddingModel,
  });

  logger.info(
    { tenantId, resumeId: resume._id, skillCount: skills.length, vectorDim: embedding.length },
    'Resume ingested successfully'
  );

  return resume;
}

/**
 * Fetch a single resume by ID within a tenant, excluding the embedding array.
 *
 * @param {{ id: string, tenantId: string }} params
 * @returns {Promise<import('../models/Resume.js').Resume>}
 */
export async function getResumeById({ id, tenantId }) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError(`Invalid resume ID: "${id}"`);
  }

  const resume = await scoped(Resume.findOne({ _id: id, tenantId }), tenantId).select('-embedding');

  if (!resume) {
    throw new NotFoundError(`Resume "${id}" not found for this tenant`);
  }

  return resume;
}

export default { uploadResume, getResumeById };
