import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

export const cacheHits = new Rate('match_cache_hits');
export const cacheMisses = new Rate('match_cache_misses');
export const fallbackResults = new Rate('match_fallbacks');
export const successfulMatches = new Rate('successful_matches');

export function config() {
  const required = ['RESUME_ID', 'TENANT_ID'];
  for (const name of required) {
    if (!__ENV[name]) {
      throw new Error(`${name} is required`);
    }
  }
  return {
    baseUrl: __ENV.BASE_URL || 'http://host.docker.internal',
    resumeId: __ENV.RESUME_ID,
    tenantId: __ENV.TENANT_ID,
    explainTop: __ENV.EXPLAIN_TOP || '3',
  };
}

export function matchRequest(settings, userId) {
  const response = http.get(
    `${settings.baseUrl}/api/resumes/${settings.resumeId}/matches?explain=true&explainTop=${settings.explainTop}&k=10`,
    {
      headers: {
        'X-Tenant-Id': settings.tenantId,
        'X-User-Id': userId,
      },
      tags: { endpoint: 'resume-matches' },
    }
  );

  const body = response.json();
  const matches = Array.isArray(body?.matches) ? body.matches : [];
  let explanations = 0;
  for (const match of matches) {
    if (!match.explanationSource) continue;
    explanations += 1;
    if (match.explanationSource === 'cache') cacheHits.add(1);
    if (match.explanationSource === 'llm') cacheMisses.add(1);
    if (match.explanationSource === 'fallback') fallbackResults.add(1);
  }

  const ok = check(response, {
    'matching request succeeded': (res) => res.status === 200,
  });
  successfulMatches.add(ok ? 1 : 0);
  return { response, explanations };
}

export function summary(data) {
  return {
    stdout: JSON.stringify({
      requestsPerSecond: data.metrics.http_reqs?.values?.rate || 0,
      p50LatencyMs: data.metrics.http_req_duration?.values?.med || 0,
      p95LatencyMs: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
      errorRate: data.metrics.http_req_failed?.values?.rate || 0,
      cacheHitRate: data.metrics.match_cache_hits?.values?.rate || 0,
      successfulMatchRate: data.metrics.successful_matches?.values?.rate || 0,
      fallbackRate: data.metrics.match_fallbacks?.values?.rate || 0,
    }, null, 2),
  };
}
