import { beforeEach, describe, expect, it, vi } from 'vitest';

let now = 0;
let state;
let redisError = null;

vi.mock('../lib/redis.js', () => ({
  redisCommand: vi.fn(async (_command, _script, _keys, key, timestamp, capacity, refill) => {
    if (redisError) throw redisError;
    const current = state.get(key) ?? { tokens: capacity, timestamp };
    current.tokens = Math.min(capacity, current.tokens + ((timestamp - current.timestamp) / 1000) * refill);
    current.timestamp = timestamp;
    const allowed = current.tokens >= 1 ? 1 : 0;
    if (allowed) current.tokens -= 1;
    state.set(key, current);
    return [allowed, Math.floor(current.tokens), 1];
  }),
  isRedisUnavailable: (error) => error?.code === 'ECONNREFUSED',
}));

function response() {
  return {
    headers: {},
    set(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
}

describe('rate limiter', () => {
  beforeEach(() => {
    now = 0;
    state = new Map();
    redisError = null;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  it('allows, blocks, and allows again after token refill', async () => {
    const { createRateLimiter } = await import('../middleware/rateLimiter.js');
    const middleware = createRateLimiter();
    const req = { query: {}, body: {}, ip: '127.0.0.1', get: () => undefined };

    for (let index = 0; index < 60; index += 1) {
      await middleware(req, response(), vi.fn());
    }

    const blockedResponse = response();
    const blockedNext = vi.fn();
    await middleware(req, blockedResponse, blockedNext);
    expect(blockedNext).not.toHaveBeenCalled();
    expect(blockedResponse.statusCode).toBe(429);

    now += 1000;
    const refilledNext = vi.fn();
    await middleware(req, response(), refilledNext);
    expect(refilledNext).toHaveBeenCalled();
  });

  it('fails open for cheap requests and closed for AI requests when Redis is down', async () => {
    const { createRateLimiter } = await import('../middleware/rateLimiter.js');
    const middleware = createRateLimiter();
    redisError = Object.assign(new Error('Redis unavailable'), { code: 'ECONNREFUSED' });

    const cheapNext = vi.fn();
    await middleware(
      { query: {}, body: {}, ip: 'cheap-user', get: () => undefined },
      response(),
      cheapNext
    );
    expect(cheapNext).toHaveBeenCalled();

    const aiResponse = response();
    const aiNext = vi.fn();
    await middleware(
      { query: { explain: 'true' }, body: {}, ip: 'ai-user', get: () => undefined },
      aiResponse,
      aiNext
    );
    expect(aiNext).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 503,
      code: 'RATE_LIMITER_UNAVAILABLE',
    }));
  });
});
