import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env
dotenv.config();

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HTTP_BODY_LIMIT: z.string().min(1).default('1mb'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  DB_MAX_RETRIES: z.coerce.number().int().positive().default(5),
  DB_INITIAL_RETRY_DELAY_MS: z.coerce.number().int().positive().default(2000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  EMBEDDING_API_URL: z.string().url('EMBEDDING_API_URL must be a valid URL'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  EMBEDDING_MODEL: z.string().min(1, 'EMBEDDING_MODEL is required'),
  EMBEDDING_MAX_INPUT_CHARACTERS: z.coerce.number().int().positive().default(16000),
  EMBEDDING_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  EMBEDDING_RETRY_BASE_MS: z.coerce.number().int().positive().default(1000),
  LLM_MODEL: z.string().min(1, 'LLM_MODEL is required'),
  LLM_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  LLM_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  LLM_RETRY_BASE_MS: z.coerce.number().int().positive().default(1000),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  MATCHING_DEFAULT_K: z.coerce.number().int().positive().default(10),
  EXPLANATION_DEFAULT_TOP: z.coerce.number().int().positive().default(3),
  SEMANTIC_CACHE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.95),
  CHEAP_RATE_LIMIT_CAPACITY: z.coerce.number().int().positive().default(60),
  CHEAP_RATE_LIMIT_REFILL_PER_SECOND: z.coerce.number().positive().default(1),
  AI_RATE_LIMIT_CAPACITY: z.coerce.number().int().positive().default(10),
  AI_RATE_LIMIT_REFILL_PER_SECOND: z.coerce.number().positive().default(0.1),
  LLM_BREAKER_FAILURE_THRESHOLD: z.coerce.number().min(1).max(100).default(50),
  LLM_BREAKER_ROLLING_WINDOW_MS: z.coerce.number().int().positive().default(10000),
  LLM_BREAKER_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  BULK_EMBED_CONCURRENCY: z.coerce.number().int().positive().default(4),
  QUEUE_JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  QUEUE_BACKOFF_MS: z.coerce.number().int().positive().default(1000),
  QUEUE_REMOVE_ON_COMPLETE_AGE_SECONDS: z.coerce.number().int().positive().default(86400),
  QUEUE_REMOVE_ON_COMPLETE_COUNT: z.coerce.number().int().positive().default(1000),
  CACHE_MAX_RECENT_ENTRIES: z.coerce.number().int().positive().default(200),
  LLM_RESUME_EXCERPT_CHARACTERS: z.coerce.number().int().positive().default(1600),
  LLM_JOB_EXCERPT_CHARACTERS: z.coerce.number().int().positive().default(1600),
  EMBEDDING_INPUT_PRICE_PER_1K_TOKENS: z.coerce.number().nonnegative().default(0),
  LLM_INPUT_PRICE_PER_1K_TOKENS: z.coerce.number().nonnegative().default(0),
  LLM_OUTPUT_PRICE_PER_1K_TOKENS: z.coerce.number().nonnegative().default(0),
  LLM_AVERAGE_INPUT_TOKENS: z.coerce.number().int().nonnegative().default(1000),
  LLM_AVERAGE_OUTPUT_TOKENS: z.coerce.number().int().nonnegative().default(200),
  LLM_FORCE_FAILURE: z.preprocess(
    (value) => value === true || value === 'true',
    z.boolean()
  ).default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:5173,http://localhost'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(86400),
});

export function validateConfig(env = process.env) {
  const isTest = env.NODE_ENV === 'test';

  const rawEnv = {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    HTTP_BODY_LIMIT: env.HTTP_BODY_LIMIT,
    UPLOAD_MAX_BYTES: env.UPLOAD_MAX_BYTES,
    DB_MAX_RETRIES: env.DB_MAX_RETRIES,
    DB_INITIAL_RETRY_DELAY_MS: env.DB_INITIAL_RETRY_DELAY_MS,
    MONGO_URI: env.MONGO_URI ?? (isTest ? 'mongodb://localhost:27017/resumematcher_test' : undefined),
    REDIS_URL: env.REDIS_URL ?? (isTest ? 'redis://localhost:6379' : undefined),
    EMBEDDING_API_URL: env.EMBEDDING_API_URL ?? 'http://localhost:11434',
    GEMINI_API_KEY: env.GEMINI_API_KEY ?? (isTest ? 'test-gemini-api-key' : undefined),
    EMBEDDING_MODEL: env.EMBEDDING_MODEL ?? 'embeddinggemma',
    EMBEDDING_MAX_INPUT_CHARACTERS: env.EMBEDDING_MAX_INPUT_CHARACTERS,
    EMBEDDING_MAX_RETRIES: env.EMBEDDING_MAX_RETRIES,
    EMBEDDING_RETRY_BASE_MS: env.EMBEDDING_RETRY_BASE_MS,
    LLM_MODEL: env.LLM_MODEL ?? (isTest ? 'gemini-3.5-flash-lite' : undefined),
    LLM_MAX_RETRIES: env.LLM_MAX_RETRIES,
    LLM_REQUEST_TIMEOUT_MS: env.LLM_REQUEST_TIMEOUT_MS,
    LLM_RETRY_BASE_MS: env.LLM_RETRY_BASE_MS,
    CACHE_TTL_SECONDS: env.CACHE_TTL_SECONDS,
    MATCHING_DEFAULT_K: env.MATCHING_DEFAULT_K,
    EXPLANATION_DEFAULT_TOP: env.EXPLANATION_DEFAULT_TOP,
    SEMANTIC_CACHE_THRESHOLD: env.SEMANTIC_CACHE_THRESHOLD,
    CHEAP_RATE_LIMIT_CAPACITY: env.CHEAP_RATE_LIMIT_CAPACITY,
    CHEAP_RATE_LIMIT_REFILL_PER_SECOND: env.CHEAP_RATE_LIMIT_REFILL_PER_SECOND,
    AI_RATE_LIMIT_CAPACITY: env.AI_RATE_LIMIT_CAPACITY,
    AI_RATE_LIMIT_REFILL_PER_SECOND: env.AI_RATE_LIMIT_REFILL_PER_SECOND,
    LLM_BREAKER_FAILURE_THRESHOLD: env.LLM_BREAKER_FAILURE_THRESHOLD,
    LLM_BREAKER_ROLLING_WINDOW_MS: env.LLM_BREAKER_ROLLING_WINDOW_MS,
    LLM_BREAKER_RESET_TIMEOUT_MS: env.LLM_BREAKER_RESET_TIMEOUT_MS,
    BULK_EMBED_CONCURRENCY: env.BULK_EMBED_CONCURRENCY,
    QUEUE_JOB_ATTEMPTS: env.QUEUE_JOB_ATTEMPTS,
    QUEUE_BACKOFF_MS: env.QUEUE_BACKOFF_MS,
    QUEUE_REMOVE_ON_COMPLETE_AGE_SECONDS: env.QUEUE_REMOVE_ON_COMPLETE_AGE_SECONDS,
    QUEUE_REMOVE_ON_COMPLETE_COUNT: env.QUEUE_REMOVE_ON_COMPLETE_COUNT,
    CACHE_MAX_RECENT_ENTRIES: env.CACHE_MAX_RECENT_ENTRIES,
    LLM_RESUME_EXCERPT_CHARACTERS: env.LLM_RESUME_EXCERPT_CHARACTERS,
    LLM_JOB_EXCERPT_CHARACTERS: env.LLM_JOB_EXCERPT_CHARACTERS,
    EMBEDDING_INPUT_PRICE_PER_1K_TOKENS: env.EMBEDDING_INPUT_PRICE_PER_1K_TOKENS,
    LLM_INPUT_PRICE_PER_1K_TOKENS: env.LLM_INPUT_PRICE_PER_1K_TOKENS,
    LLM_OUTPUT_PRICE_PER_1K_TOKENS: env.LLM_OUTPUT_PRICE_PER_1K_TOKENS,
    LLM_AVERAGE_INPUT_TOKENS: env.LLM_AVERAGE_INPUT_TOKENS,
    LLM_AVERAGE_OUTPUT_TOKENS: env.LLM_AVERAGE_OUTPUT_TOKENS,
    LLM_FORCE_FAILURE: env.LLM_FORCE_FAILURE,
    LOG_LEVEL: env.LOG_LEVEL ?? (isTest ? 'silent' : undefined),
    CORS_ORIGINS: env.CORS_ORIGINS ?? (isTest ? 'http://localhost:5173' : undefined),
    JWT_SECRET: env.JWT_SECRET ?? (isTest ? 'test-jwt-secret-that-is-at-least-32-chars' : undefined),
    JWT_EXPIRES_IN_SECONDS: env.JWT_EXPIRES_IN_SECONDS,
  };

  const parsed = configSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const formattedErrors = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    const errorMessage = `\n========================================\n[CONFIG ERROR] Invalid environment configuration:\n${formattedErrors}\n========================================\nPlease check your .env file against .env.example.\n`;
    throw new Error(errorMessage);
  }

  return Object.freeze(parsed.data);
}

export const config = validateConfig(process.env);
export default config;
