import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map();
const lists = new Map();

vi.mock('../lib/redis.js', () => ({
  redisCommand: vi.fn(async (command, ...args) => {
    if (command === 'get') return store.get(args[0]) ?? null;
    if (command === 'set') {
      store.set(args[0], args[1]);
      return 'OK';
    }
    if (command === 'lrange') return lists.get(args[0])?.slice(args[1], args[2] + 1) ?? [];
    if (command === 'lpush') {
      const list = lists.get(args[0]) ?? [];
      list.unshift(args[1]);
      lists.set(args[0], list);
      return list.length;
    }
    if (command === 'ltrim') return 'OK';
    if (command === 'expire') return 1;
    if (command === 'incr') return 1;
    throw new Error(`Unexpected Redis command: ${command}`);
  }),
}));

describe('explanationCache', () => {
  beforeEach(() => {
    store.clear();
    lists.clear();
  });

  it('returns an exact hit and keeps cache keys tenant-scoped', async () => {
    const { setCachedExplanation, getCachedExplanation } = await import('../services/explanationCache.js');
    await setCachedExplanation({
      tenantId: 'tenant-a',
      resumeContentHash: 'resume-1',
      jobContentHash: 'job-1',
      jobEmbedding: [1, 0],
      explanation: 'Exact explanation',
    });

    await expect(getCachedExplanation({
      tenantId: 'tenant-a',
      resumeContentHash: 'resume-1',
      jobContentHash: 'job-1',
      jobEmbedding: [0, 1],
    })).resolves.toEqual({ hit: true, level: 'exact', explanation: 'Exact explanation' });

    await expect(getCachedExplanation({
      tenantId: 'tenant-b',
      resumeContentHash: 'resume-1',
      jobContentHash: 'job-1',
      jobEmbedding: [1, 0],
    })).resolves.toMatchObject({ hit: false });
  });

  it('returns semantic hits above the threshold but misses below it', async () => {
    const { setCachedExplanation, getCachedExplanation } = await import('../services/explanationCache.js');
    await setCachedExplanation({
      tenantId: 'tenant-a',
      resumeContentHash: 'resume-2',
      jobContentHash: 'job-original',
      jobEmbedding: [1, 0],
      explanation: 'Near duplicate explanation',
    });

    await expect(getCachedExplanation({
      tenantId: 'tenant-a',
      resumeContentHash: 'resume-2',
      jobContentHash: 'job-near',
      jobEmbedding: [0.999, 0.045],
    })).resolves.toMatchObject({ hit: true, level: 'semantic' });

    await expect(getCachedExplanation({
      tenantId: 'tenant-a',
      resumeContentHash: 'resume-2',
      jobContentHash: 'job-far',
      jobEmbedding: [0, 1],
    })).resolves.toMatchObject({ hit: false });
  });
});
