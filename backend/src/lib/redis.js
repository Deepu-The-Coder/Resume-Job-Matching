import Redis from 'ioredis';
import config from '../config.js';
import logger from './logger.js';

let client;

function getRedisClient() {
  if (!client) {
    client = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 500,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2000),
    });
    client.on('error', (error) => {
      logger.warn({ err: error.message, tenantId: 'system', requestId: 'redis' }, 'Redis connection error');
    });
  }
  return client;
}

export async function redisCommand(command, ...args) {
  const redis = getRedisClient();
  if (redis.status === 'wait') {
    await redis.connect();
  }
  return redis[command](...args);
}

export async function closeRedis() {
  if (client) {
    await client.quit().catch(() => client.disconnect());
    client = undefined;
  }
}

export async function getRedisStatus() {
  try {
    await redisCommand('ping');
    return { status: 'connected' };
  } catch (error) {
    return { status: 'degraded', error: error.message };
  }
}

export function isRedisUnavailable(error) {
  return ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'NR_CLOSED'].includes(
    error?.code ?? error?.cause?.code
  ) || /connect|offline|closed|redis/i.test(error?.message || '');
}

export function resetRedisClient() {
  if (client) {
    client.disconnect();
    client = undefined;
  }
}

export default { redisCommand, getRedisStatus, closeRedis, isRedisUnavailable, resetRedisClient };
