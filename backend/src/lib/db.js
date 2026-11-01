import mongoose from 'mongoose';
import logger from './logger.js';

const READY_STATE_MAP = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Returns current database connection health/status.
 */
export function getDBStatus() {
  const readyState = mongoose.connection.readyState;
  return {
    readyState,
    status: READY_STATE_MAP[readyState] || 'unknown',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
}

/**
 * Connect to MongoDB with retry logic and exponential backoff.
 */
export async function connectDB({
  uri,
  maxRetries = 5,
  initialRetryDelayMs = 1000,
} = {}) {
  let attempt = 0;
  let delay = initialRetryDelayMs;

  while (attempt < maxRetries) {
    try {
      attempt += 1;
      logger.info({ attempt, maxRetries, tenantId: 'system', requestId: 'startup' }, `Attempting MongoDB connection (${attempt}/${maxRetries})...`);

      await mongoose.connect(uri);

      logger.info(
        {
          host: mongoose.connection.host,
          database: mongoose.connection.name,
          tenantId: 'system',
          requestId: 'startup',
        },
        'MongoDB connected successfully'
      );
      return mongoose.connection;
    } catch (error) {
      logger.error(
        {
          attempt,
          maxRetries,
          err: error.message,
          tenantId: 'system',
          requestId: 'startup',
        },
        `MongoDB connection attempt ${attempt} failed`
      );

      if (attempt >= maxRetries) {
        throw new Error(`MongoDB connection failed after ${maxRetries} attempts: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 1.5; // Exponential backoff
    }
  }
}

/**
 * Disconnect from MongoDB gracefully.
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info({ tenantId: 'system', requestId: 'shutdown' }, 'MongoDB disconnected');
  }
}

export default {
  connectDB,
  disconnectDB,
  getDBStatus,
};
