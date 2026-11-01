import config from '../config.js';
import logger from './logger.js';
import CircuitBreaker from 'opossum';
import { recordUsage } from '../services/usageTrackingService.js';

function isTransientError(error) {
  const code = error?.code ?? error?.cause?.code;
  return error?.status === 429
    || error?.status >= 500
    || ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT'].includes(code);
}

async function requestGemini({ system, user }) {
  if (config.LLM_FORCE_FAILURE) {
    throw Object.assign(new Error('LLM failure forced by configuration'), {
      code: 'LLM_FORCED_FAILURE',
      statusCode: 503,
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.LLM_REQUEST_TIMEOUT_MS);
  try {
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${config.LLM_MODEL}:generateContent`);
    url.searchParams.set('key', config.GEMINI_API_KEY);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`LLM provider returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      error.code = 'ETIMEDOUT';
      error.message = `LLM request timed out after ${config.LLM_REQUEST_TIMEOUT_MS}ms`;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithRetries({ system, user, tenantId = 'system', requestId = 'unknown' }) {
  const startedAt = performance.now();
  let lastError;
  for (let attempt = 0; attempt <= config.LLM_MAX_RETRIES; attempt += 1) {
    try {
      const response = await requestGemini({ system, user });
      const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
      if (!text) throw new Error('LLM returned an empty response');
      const usage = {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      };
      await recordUsage({
        tenantId,
        type: 'llm',
        source: 'llm',
        tokensIn: usage.inputTokens,
        tokensOut: usage.outputTokens,
        latencyMs: Number((performance.now() - startedAt).toFixed(2)),
        requestId,
      });
      logger.info({ provider: 'gemini', model: config.LLM_MODEL, ...usage, tenantId, requestId }, 'LLM call succeeded');
      return { text, usage };
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt === config.LLM_MAX_RETRIES) break;
      const backoffMs = config.LLM_RETRY_BASE_MS * (attempt + 1);
      logger.warn({ attempt: attempt + 1, backoffMs, err: error.message, tenantId, requestId }, 'Transient LLM failure; retrying');
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw Object.assign(
    new Error(`LLM generation failed after ${config.LLM_MAX_RETRIES + 1} attempts: ${lastError?.message}`),
    { statusCode: 502, code: 'LLM_API_ERROR' }
  );
}

const breaker = new CircuitBreaker(generateWithRetries, {
  errorThresholdPercentage: config.LLM_BREAKER_FAILURE_THRESHOLD,
  rollingCountTimeout: config.LLM_BREAKER_ROLLING_WINDOW_MS,
  resetTimeout: config.LLM_BREAKER_RESET_TIMEOUT_MS,
  volumeThreshold: 1,
  timeout: false,
});
for (const [event, state, level] of [['open', 'open', 'warn'], ['halfOpen', 'half-open', 'info'], ['close', 'closed', 'info']]) {
  breaker.on(event, () => logger[level]({ state, tenantId: 'system', requestId: 'system' }, 'LLM circuit breaker state changed'));
}

export function generate({ system, user, tenantId, requestId }) {
  return breaker.fire({ system, user, tenantId, requestId });
}

export function getBreakerState() {
  if (breaker.opened) return 'open';
  if (breaker.halfOpen) return 'half-open';
  return 'closed';
}

export default { generate, getBreakerState };
