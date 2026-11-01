import pino from 'pino';
import config from '../config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: {
    env: config.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
