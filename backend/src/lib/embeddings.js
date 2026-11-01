import config from '../config.js';
import logger from './logger.js';
import { recordUsage } from '../services/usageTrackingService.js';

function truncateText(text) {
  if (text.length <= config.EMBEDDING_MAX_INPUT_CHARACTERS) return text;
  const truncated = text.slice(0, config.EMBEDDING_MAX_INPUT_CHARACTERS);
  const lastSentence = truncated.lastIndexOf('.');
  return lastSentence > config.EMBEDDING_MAX_INPUT_CHARACTERS * 0.8
    ? truncated.slice(0, lastSentence + 1)
    : truncated;
}

function isTransientError(error) {
  const code = error?.code ?? error?.cause?.code;
  return error?.status === 429
    || error?.status >= 500
    || ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT'].includes(code);
}

export async function embedText(text, { tenantId = 'system', requestId = 'unknown' } = {}) {
  const startedAt = performance.now();
  const input = truncateText(String(text));
  const charCount = input.length;
  logger.info(
    { charCount, model: config.EMBEDDING_MODEL, tenantId, requestId },
    'Calling embeddings API'
  );

  let lastError;
  for (let attempt = 0; attempt <= config.EMBEDDING_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${config.EMBEDDING_API_URL}/api/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: config.EMBEDDING_MODEL,
          input,
          truncate: true,
        }),
      });

      if (!response.ok) {
        const error = new Error(`Embeddings API returned HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      const payload = await response.json();
      const embedding = payload.embeddings?.[0];
      if (!Array.isArray(embedding)) throw new Error('Embeddings API returned no vector');

      const tokensIn = payload.prompt_eval_count ?? Math.ceil(charCount / 4);
      await recordUsage({
        tenantId,
        type: 'embedding',
        source: 'embedding',
        tokensIn,
        tokensOut: 0,
        latencyMs: Number((performance.now() - startedAt).toFixed(2)),
        requestId,
      });
      logger.info(
        { charCount, model: config.EMBEDDING_MODEL, tokensIn, vectorDimensions: embedding.length, tenantId, requestId },
        'Embeddings API call succeeded'
      );
      return embedding;
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt === config.EMBEDDING_MAX_RETRIES) break;
      const backoffMs = config.EMBEDDING_RETRY_BASE_MS * (attempt + 1);
      logger.warn({ attempt: attempt + 1, backoffMs, err: error.message, tenantId, requestId }, 'Transient embeddings API failure; retrying');
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  await recordUsage({
    tenantId,
    type: 'embedding',
    source: 'embedding',
    tokensIn: Math.ceil(charCount / 4),
    tokensOut: 0,
    latencyMs: Number((performance.now() - startedAt).toFixed(2)),
    requestId,
  });
  throw Object.assign(
    new Error(`Embeddings failed after ${config.EMBEDDING_MAX_RETRIES + 1} attempts: ${lastError?.message}`),
    { statusCode: 502, code: 'EMBEDDING_API_ERROR' }
  );
}

export default { embedText };
