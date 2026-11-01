import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('LLM circuit breaker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  it('opens after a failure, half-opens after reset, and closes on recovery', async () => {
    const testConfig = {
      LLM_FORCE_FAILURE: true,
      LLM_BREAKER_FAILURE_THRESHOLD: 50,
      LLM_BREAKER_ROLLING_WINDOW_MS: 1000,
      LLM_BREAKER_RESET_TIMEOUT_MS: 20,
      LLM_MODEL: 'test-model',
      LLM_MAX_RETRIES: 2,
      LLM_REQUEST_TIMEOUT_MS: 15000,
      LLM_RETRY_BASE_MS: 1,
      GEMINI_API_KEY: 'test-key',
      LOG_LEVEL: 'silent',
    };
    vi.doMock('../config.js', () => ({ default: testConfig }));
    vi.doMock('../lib/logger.js', () => ({
      default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));

    const { generate, getBreakerState } = await import('../services/llmService.js');
    await expect(generate({ system: 's', user: 'u' })).rejects.toThrow();
    expect(getBreakerState()).toBe('open');

    await expect(generate({ system: 's', user: 'u' })).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(21);
    expect(getBreakerState()).toBe('half-open');

    testConfig.LLM_FORCE_FAILURE = false;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Recovered explanation' }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      }),
    }));

    await expect(generate({ system: 's', user: 'u' })).resolves.toMatchObject({
      text: 'Recovered explanation',
    });
    expect(getBreakerState()).toBe('closed');
  });
});
