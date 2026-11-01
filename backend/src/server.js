import app from './app.js';
import config from './config.js';
import logger from './lib/logger.js';
import { connectDB, disconnectDB } from './lib/db.js';

let server;

async function startServer() {
  try {
    // Connect to database with retry logic
    await connectDB({
      uri: config.MONGO_URI,
      maxRetries: config.DB_MAX_RETRIES,
      initialRetryDelayMs: config.DB_INITIAL_RETRY_DELAY_MS,
    });

    server = app.listen(config.PORT, () => {
      logger.info(
        {
          port: config.PORT,
          env: config.NODE_ENV,
          tenantId: 'system',
          requestId: 'startup',
        },
        `Server listening on http://localhost:${config.PORT}`
      );
    });
  } catch (error) {
    logger.fatal({ err: error.message, tenantId: 'system', requestId: 'startup' }, 'Failed to start server');
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  logger.info({ signal, tenantId: 'system', requestId: 'shutdown' }, `Received ${signal}, initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info({ tenantId: 'system', requestId: 'shutdown' }, 'HTTP server closed');
      try {
        await disconnectDB();
        logger.info({ tenantId: 'system', requestId: 'shutdown' }, 'Process terminated gracefully');
        process.exit(0);
      } catch (err) {
        logger.error({ err: err.message, tenantId: 'system', requestId: 'shutdown' }, 'Error during DB disconnect');
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason, tenantId: 'system', requestId: 'process' }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack, tenantId: 'system', requestId: 'process' }, 'Uncaught Exception thrown');
  process.exit(1);
});

startServer();
