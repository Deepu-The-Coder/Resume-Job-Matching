import { describe, expect, it } from 'vitest';
import { calculateStats } from '../services/usageTrackingService.js';

describe('usage statistics aggregation', () => {
  it('calculates cache levels, savings, spend, and p95 from fixture events', () => {
    const result = calculateStats({
      requests: [
        { createdAt: '2026-01-01T00:00:00.000Z', latencyMs: 100, querySummary: 'resume:r1', source: 'cache' },
        { createdAt: '2026-01-01T00:01:00.000Z', latencyMs: 300, querySummary: 'job:j1', source: 'llm' },
        { createdAt: '2026-01-01T00:02:00.000Z', latencyMs: 200, querySummary: 'resume:r2', source: 'fallback' },
      ],
      usage: [
        { source: 'cache', cacheLevel: 'exact', latencyMs: 10, estimatedCost: 0, estimatedCostSaved: 0.02 },
        { source: 'cache', cacheLevel: 'semantic', latencyMs: 20, estimatedCost: 0, estimatedCostSaved: 0.02 },
        { source: 'cache-miss', latencyMs: 30, estimatedCost: 0, estimatedCostSaved: 0 },
        { source: 'llm', latencyMs: 200, estimatedCost: 0.03, estimatedCostSaved: 0 },
        { source: 'fallback', latencyMs: 40, estimatedCost: 0, estimatedCostSaved: 0 },
      ],
    });

    expect(result.totalRequests).toBe(3);
    expect(result.aiCallsMade).toBe(1);
    expect(result.cache).toMatchObject({
      hits: 2,
      exactHits: 1,
      semanticHits: 1,
      misses: 1,
      hitRate: 0.6667,
    });
    expect(result.fallbackCount).toBe(1);
    expect(result.totalEstimatedSpend).toBe(0.03);
    expect(result.estimatedCostSaved).toBe(0.04);
    expect(result.latency.p95Ms).toBe(300);
    expect(result.latency.cache.averageLatencyMs).toBe(15);
    expect(result.latency.llm.p95LatencyMs).toBe(200);
  });
});
