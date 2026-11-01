import config from '../config.js';
import { cosineSimilarity } from './similarityService.js';
import { redisCommand } from '../lib/redis.js';

function exactKey(tenantId, resumeHash, jobHash) {
  return `cache:${tenantId}:expl:${resumeHash}:${jobHash}`;
}

function recentKey(tenantId, resumeHash) {
  return `cache:${tenantId}:expl:${resumeHash}:recent`;
}

function hit(level, explanation) {
  return { hit: true, level, explanation };
}

async function increment(tenantId, counter) {
  await redisCommand('incr', `cache:stats:${tenantId}:${counter}`);
}

export async function getCachedExplanation({
  tenantId,
  resumeContentHash,
  jobContentHash,
  jobEmbedding,
}) {
  const exact = await redisCommand('get', exactKey(tenantId, resumeContentHash, jobContentHash));
  if (exact) {
    const parsed = JSON.parse(exact);
    await increment(tenantId, 'hits');
    return hit('exact', parsed.explanation);
  }

  const recent = await redisCommand('lrange', recentKey(tenantId, resumeContentHash), 0, config.CACHE_MAX_RECENT_ENTRIES - 1);
  for (const entry of recent) {
    const parsed = JSON.parse(entry);
    if (
      cosineSimilarity(jobEmbedding, parsed.jobEmbedding) >= config.SEMANTIC_CACHE_THRESHOLD
    ) {
      await increment(tenantId, 'hits');
      return hit('semantic', parsed.explanation);
    }
  }

  await increment(tenantId, 'misses');
  return { hit: false, level: null, explanation: null };
}

export async function setCachedExplanation({
  tenantId,
  resumeContentHash,
  jobContentHash,
  jobEmbedding,
  explanation,
}) {
  const value = JSON.stringify({ jobContentHash, jobEmbedding, explanation });
  const exact = exactKey(tenantId, resumeContentHash, jobContentHash);
  const recent = recentKey(tenantId, resumeContentHash);

  await redisCommand('set', exact, JSON.stringify({ explanation }), 'EX', config.CACHE_TTL_SECONDS);
  await redisCommand('lpush', recent, value);
  await redisCommand('ltrim', recent, 0, config.CACHE_MAX_RECENT_ENTRIES - 1);
  await redisCommand('expire', recent, config.CACHE_TTL_SECONDS);
}

export default { getCachedExplanation, setCachedExplanation };
