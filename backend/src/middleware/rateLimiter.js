import config from '../config.js';
import { redisCommand, isRedisUnavailable } from '../lib/redis.js';

const TOKEN_BUCKET_SCRIPT = `
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillPerSecond = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local state = redis.call('HMGET', KEYS[1], 'tokens', 'timestamp')
local tokens = tonumber(state[1])
local timestamp = tonumber(state[2])
if not tokens then tokens = capacity end
if not timestamp then timestamp = now end
tokens = math.min(capacity, tokens + ((now - timestamp) / 1000) * refillPerSecond)
local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'timestamp', now)
local ttl = math.ceil((capacity - tokens) / refillPerSecond)
redis.call('EXPIRE', KEYS[1], math.max(ttl, 1))
return {allowed, math.floor(tokens), math.max(ttl, 1)}
`;

function isAiRequest(req) {
  return req.query?.explain === 'true';
}

function identity(req) {
  return req.user?.sub || req.ip;
}

function options(ai) {
  return ai
    ? {
      capacity: config.AI_RATE_LIMIT_CAPACITY,
      refillPerSecond: config.AI_RATE_LIMIT_REFILL_PER_SECOND,
      prefix: 'ai',
    }
    : {
      capacity: config.CHEAP_RATE_LIMIT_CAPACITY,
      refillPerSecond: config.CHEAP_RATE_LIMIT_REFILL_PER_SECOND,
      prefix: 'cheap',
    };
}

export function createRateLimiter() {
  return async function rateLimiter(req, res, next) {
    const ai = isAiRequest(req);
    const selected = options(ai);
    const key = `ratelimit:${selected.prefix}:${identity(req)}`;

    try {
      const [allowed, remaining, retryAfter] = await redisCommand(
        'eval',
        TOKEN_BUCKET_SCRIPT,
        1,
        key,
        Date.now(),
        selected.capacity,
        selected.refillPerSecond,
        1
      );

      res.set('X-RateLimit-Remaining', String(remaining));
      if (!allowed) {
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: {
            message: 'Rate limit exceeded',
            code: 'RATE_LIMITED',
          },
        });
      }
      return next();
    } catch (error) {
      if (isRedisUnavailable(error) || error?.code === 'ECONNREFUSED') {
        // Cheap endpoints fail open for availability; AI endpoints fail closed to protect spend.
        if (!ai) return next();
        const unavailable = new Error('AI rate limiting is unavailable; try again later');
        unavailable.statusCode = 503;
        unavailable.code = 'RATE_LIMITER_UNAVAILABLE';
        return next(unavailable);
      }
      return next(error);
    }
  };
}

export default { createRateLimiter };
