import Redis from 'ioredis';
import { Queue } from 'bullmq';
import config from '../config.js';

export const MATCHING_QUEUE_NAME = 'matching-background-work';

export function createQueueConnection() {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function defaultQueueOptions() {
  return {
    attempts: config.QUEUE_JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: config.QUEUE_BACKOFF_MS },
    removeOnComplete: {
      age: config.QUEUE_REMOVE_ON_COMPLETE_AGE_SECONDS,
      count: config.QUEUE_REMOVE_ON_COMPLETE_COUNT,
    },
    removeOnFail: false,
  };
}

let queue;

export function getMatchingQueue() {
  if (!queue) {
    queue = new Queue(MATCHING_QUEUE_NAME, {
      connection: createQueueConnection(),
      defaultJobOptions: defaultQueueOptions(),
    });
  }
  return queue;
}

export async function enqueueBulkEmbed(data) {
  const job = await getMatchingQueue().add('bulk-embed', data);
  return job.id;
}

export async function enqueueBulkMatch(data) {
  const job = await getMatchingQueue().add('bulk-match', data);
  return job.id;
}

export async function getQueueJob(jobId) {
  return getMatchingQueue().getJob(jobId);
}

export async function listFailedQueueJobs() {
  return getMatchingQueue().getFailed(0, 99);
}

export async function closeMatchingQueue() {
  if (queue) {
    await queue.close();
    queue = undefined;
  }
}

export default {
  MATCHING_QUEUE_NAME,
  createQueueConnection,
  defaultQueueOptions,
  getMatchingQueue,
  enqueueBulkEmbed,
  enqueueBulkMatch,
  getQueueJob,
  listFailedQueueJobs,
  closeMatchingQueue,
};
