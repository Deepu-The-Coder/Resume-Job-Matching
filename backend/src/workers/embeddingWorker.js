import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { MATCHING_QUEUE_NAME, createQueueConnection } from '../lib/queue.js';
import { connectDB, disconnectDB } from '../lib/db.js';
import { Resume, Job, Match } from '../models/index.js';
import { embedText } from '../services/embeddingService.js';
import { rankTopK } from '../services/similarityService.js';
import config from '../config.js';
import logger from '../lib/logger.js';
import { scoped } from '../lib/tenantScope.js';

function modelForType(type) {
  if (type === 'resume') return Resume;
  if (type === 'job') return Job;
  throw new Error(`Unsupported bulk-embed type: ${type}`);
}

async function processBulkEmbed(job) {
  const { tenantId, type, ids } = job.data;
  const Model = modelForType(type);
  const documents = await scoped(Model.find({
    _id: { $in: ids.filter((id) => mongoose.Types.ObjectId.isValid(id)) },
    $or: [{ embedding: { $size: 0 } }, { embeddingModel: { $ne: config.EMBEDDING_MODEL } }],
  }), tenantId);
  const failures = [];
  let processed = 0;

  for (let offset = 0; offset < documents.length; offset += config.BULK_EMBED_CONCURRENCY) {
    const batch = documents.slice(offset, offset + config.BULK_EMBED_CONCURRENCY);
    await Promise.all(batch.map(async (document) => {
      try {
        const text = type === 'resume'
          ? document.parsedText
          : `${document.title}\n${document.description}`;
        const embedding = await embedText(text);
        await scoped(Model.updateOne(
          { _id: document._id, tenantId },
          { $set: { embedding, embeddingModel: config.EMBEDDING_MODEL } }
        ), tenantId);
      } catch (error) {
        failures.push({ id: String(document._id), message: error.message });
      } finally {
        processed += 1;
        await job.updateProgress(Math.round((processed / Math.max(documents.length, 1)) * 100));
      }
    }));
  }

  if (failures.length) {
    throw new Error(JSON.stringify({ failures }));
  }
  await job.updateProgress(100);
  return { processed, skipped: ids.length - documents.length };
}

async function processBulkMatch(job) {
  const { tenantId, jobId, k } = job.data;
  const source = await scoped(Job.findOne({ _id: jobId, tenantId }), tenantId);
  if (!source || !source.embedding?.length) throw new Error('Job not found or has no embedding');
  const resumes = await scoped(Resume.find({ tenantId, embedding: { $exists: true, $ne: [] } }), tenantId);
  const ranked = rankTopK(source.embedding, resumes, k);

  for (const [index, resume] of ranked.entries()) {
    await scoped(Match.findOneAndUpdate(
      { resumeId: resume._id, jobId: source._id },
      {
        $set: { similarityScore: resume.similarityScore },
        $setOnInsert: { explanation: null, explanationSource: null },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ), tenantId);
    await job.updateProgress(Math.round(((index + 1) / Math.max(ranked.length, 1)) * 100));
  }
  await job.updateProgress(100);
  return { processed: ranked.length };
}

export async function processQueueJob(job) {
  if (job.name === 'bulk-embed') return processBulkEmbed(job);
  if (job.name === 'bulk-match') return processBulkMatch(job);
  throw new Error(`Unsupported queue job: ${job.name}`);
}

export async function startWorker() {
  await connectDB({
    uri: config.MONGO_URI,
    maxRetries: config.DB_MAX_RETRIES,
    initialRetryDelayMs: config.DB_INITIAL_RETRY_DELAY_MS,
  });
  const worker = new Worker(MATCHING_QUEUE_NAME, processQueueJob, {
    connection: createQueueConnection(),
    concurrency: 1,
  });
  worker.on('completed', (job) => logger.info({ jobId: job.id, type: job.name, tenantId: job.data?.tenantId || 'system', requestId: `queue:${job.id}` }, 'Background job completed'));
  worker.on('failed', (job, error) => logger.error(
    { jobId: job?.id, type: job?.name, tenantId: job?.data?.tenantId || 'system', requestId: `queue:${job?.id || 'unknown'}`, err: error.message },
    'Background job failed'
  ));
  logger.info({ queue: MATCHING_QUEUE_NAME, tenantId: 'system', requestId: 'worker' }, 'Background worker started');
  return worker;
}

if (process.argv[1]?.endsWith('embeddingWorker.js')) {
  const worker = await startWorker();
  const shutdown = async (signal) => {
    logger.info({ signal, tenantId: 'system', requestId: 'worker' }, 'Stopping background worker');
    await worker.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
