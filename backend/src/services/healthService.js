import { getDBStatus } from '../lib/db.js';
import { getRedisStatus } from '../lib/redis.js';
import config from '../config.js';
import { getBreakerState } from './llmService.js';
import { getFallbackCount } from './explanationService.js';

/**
 * Collects server and database health diagnostics.
 */
export async function getHealthStatus() {
  const dbStatus = getDBStatus();
  const redisStatus = getRedisStatus();

  const redis = await redisStatus;
  return {
    status: dbStatus.status === 'connected' && redis.status === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.NODE_ENV,
    database: dbStatus,
    redis,
    llm: {
      breakerState: getBreakerState(),
      fallbacksServed: getFallbackCount(),
    },
  };
}

export default {
  getHealthStatus,
};
