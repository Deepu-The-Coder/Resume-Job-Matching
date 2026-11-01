import { describe, it, expect } from 'vitest';
import { validateConfig } from '../config.js';

describe('Config Validation Module', () => {
  it('should validate and parse valid config with defaults', () => {
    const validEnv = {
      NODE_ENV: 'development',
      PORT: '3000',
      MONGO_URI: 'mongodb://localhost:27017/test_app',
      REDIS_URL: 'redis://localhost:6379',
      EMBEDDING_API_URL: 'http://localhost:11434',
      GEMINI_API_KEY: 'test-gemini-key',
      EMBEDDING_MODEL: 'embeddinggemma',
      LLM_MODEL: 'gemini-3.5-flash-lite',
      JWT_SECRET: 'test-development-secret-that-is-long-enough',
    };

    const cfg = validateConfig(validEnv);
    expect(cfg.PORT).toBe(3000);
    expect(cfg.NODE_ENV).toBe('development');
    expect(cfg.CACHE_TTL_SECONDS).toBe(86400);
    expect(cfg.EXPLANATION_DEFAULT_TOP).toBe(3);
    expect(cfg.LOG_LEVEL).toBe('info');
  });

  it('should throw clear error message listing missing required variables in development/production', () => {
    const emptyEnv = {
      NODE_ENV: 'production',
    };

    expect(() => validateConfig(emptyEnv)).toThrowError(/\[CONFIG ERROR\] Invalid environment configuration:/);
    expect(() => validateConfig(emptyEnv)).toThrowError(/MONGO_URI/);
    expect(() => validateConfig(emptyEnv)).not.toThrowError(/EMBEDDING_API_KEY/);
    expect(() => validateConfig(emptyEnv)).toThrowError(/GEMINI_API_KEY/);
  });
});
