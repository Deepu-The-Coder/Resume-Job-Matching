import config from '../config.js';
import { UsageLog, RequestLog } from '../models/index.js';
import logger from '../lib/logger.js';
import { scoped } from '../lib/tenantScope.js';

function costFor({ type, tokensIn = 0, tokensOut = 0 }) {
  if (type === 'embedding') {
    return (tokensIn / 1000) * config.EMBEDDING_INPUT_PRICE_PER_1K_TOKENS;
  }
  return (tokensIn / 1000) * config.LLM_INPUT_PRICE_PER_1K_TOKENS
    + (tokensOut / 1000) * config.LLM_OUTPUT_PRICE_PER_1K_TOKENS;
}

export function averageLlmCost() {
  return costFor({
    type: 'llm',
    tokensIn: config.LLM_AVERAGE_INPUT_TOKENS,
    tokensOut: config.LLM_AVERAGE_OUTPUT_TOKENS,
  });
}

export async function recordUsage(event) {
  try {
    return await UsageLog.create({
      ...event,
      estimatedCost: event.estimatedCost ?? costFor(event),
    });
  } catch (error) {
    logger.error({ err: error.message, tenantId: event.tenantId, requestId: event.requestId }, 'Usage log write failed');
    return null;
  }
}

export async function recordRequest(event) {
  try {
    return await RequestLog.create(event);
  } catch (error) {
    logger.error({ err: error.message, tenantId: event.tenantId, requestId: event.requestId }, 'Request log write failed');
    return null;
  }
}

export function calculateStats({ requests, usage }) {
  const cacheEvents = usage.filter((event) => ['cache', 'cache-miss'].includes(event.source));
  const hits = cacheEvents.filter((event) => event.source === 'cache');
  const llmCalls = usage.filter((event) => event.source === 'llm');
  const fallbacks = usage.filter((event) => event.source === 'fallback');
  const latencies = (source) => usage
    .filter((event) => event.source === source)
    .map((event) => event.latencyMs)
    .sort((a, b) => a - b);
  const percentile = (values, percentileValue) => {
    if (!values.length) return 0;
    const index = Math.min(values.length - 1, Math.ceil(values.length * percentileValue) - 1);
    return values[index];
  };
  const sourceMetrics = (source) => {
    const values = latencies(source);
    return {
      count: values.length,
      averageLatencyMs: values.length
        ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
        : 0,
      p95LatencyMs: percentile(values, 0.95),
    };
  };

  return {
    totalRequests: requests.length,
    aiCallsMade: llmCalls.length,
    cache: {
      hits: hits.length,
      exactHits: hits.filter((event) => event.cacheLevel === 'exact').length,
      semanticHits: hits.filter((event) => event.cacheLevel === 'semantic').length,
      misses: cacheEvents.length - hits.length,
      hitRate: cacheEvents.length ? Number((hits.length / cacheEvents.length).toFixed(4)) : 0,
    },
    fallbackCount: fallbacks.length,
    totalEstimatedSpend: Number(usage.reduce((sum, event) => sum + (event.estimatedCost || 0), 0).toFixed(6)),
    estimatedCostSaved: Number(usage.reduce((sum, event) => sum + (event.estimatedCostSaved || 0), 0).toFixed(6)),
    latency: {
      averageMs: requests.length
        ? Number((requests.reduce((sum, request) => sum + request.latencyMs, 0) / requests.length).toFixed(2))
        : 0,
      p95Ms: percentile(requests.map((request) => request.latencyMs).sort((a, b) => a - b), 0.95),
      cache: sourceMetrics('cache'),
      llm: sourceMetrics('llm'),
    },
    recentRequests: requests
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
      .map((request) => ({
        time: request.createdAt,
        querySummary: request.querySummary,
        source: request.source,
        latencyMs: request.latencyMs,
      })),
  };
}

function rangeStart(range) {
  const hours = range === '7d' ? 168 : 24;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export async function getStats({ tenantId, range = '24h' }) {
  const start = rangeStart(range);
  const filter = { tenantId, createdAt: { $gte: start } };
  const [requests, usage] = await Promise.all([
    scoped(RequestLog.find({ createdAt: filter.createdAt }), tenantId).lean(),
    scoped(UsageLog.find({ createdAt: filter.createdAt }), tenantId).lean(),
  ]);
  const stats = calculateStats({ requests, usage });
  const bucketMs = range === '7d' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const seriesMap = new Map();
  for (const event of usage.filter((item) => ['cache', 'cache-miss'].includes(item.source))) {
    const bucket = new Date(Math.floor(new Date(event.createdAt).getTime() / bucketMs) * bucketMs).toISOString();
    const current = seriesMap.get(bucket) || { time: bucket, hits: 0, misses: 0 };
    if (event.source === 'cache') current.hits += 1;
    else current.misses += 1;
    seriesMap.set(bucket, current);
  }
  return { range, from: start.toISOString(), ...stats, timeSeries: [...seriesMap.values()].sort((a, b) => a.time.localeCompare(b.time)) };
}

export default { recordUsage, recordRequest, averageLlmCost, calculateStats, getStats };
