import pino from 'pino';
import { getConfig } from '../config';

/**
 * Sanitize sensitive data from log messages
 * Removes API keys, tokens, and other sensitive information
 */
function sanitize(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9]{48}/gi, 'sk-[REDACTED]')
    .replace(/sk-ant-[A-Za-z0-9\-_]{95}/gi, 'sk-ant-[REDACTED]')
    .replace(/[0-9]+:[A-Za-z0-9\-_]{35}/gi, '[REDACTED_TOKEN]')
    .replace(/["\']?api[_-]?key["\']?\s*[:=]\s*["\']?[^"\'\s]+/gi, 'api_key=[REDACTED]')
    .replace(/["\']?token["\']?\s*[:=]\s*["\']?[^"\'\s]+/gi, 'token=[REDACTED]');
}

/**
 * Create a logger instance with Pino
 * Supports both JSON and pretty output formats
 */
export function createLogger(module: string = 'app') {
  const config = getConfig();

  const baseConfig: pino.LoggerOptions = {
    level: config.LOG_LEVEL,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  let logger: pino.Logger;

  if (config.LOG_FORMAT === 'pretty' && config.NODE_ENV !== 'production') {
    // Pretty format for development
    logger = pino(
      {
        ...baseConfig,
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            colorize: true,
            messageFormat: (log) => sanitize(log.msg as string),
          },
        },
      },
      pino.destination({ sync: false })
    );
  } else {
    // JSON format for production
    logger = pino(
      {
        ...baseConfig,
        serializers: {
          msg: (msg) => sanitize(msg),
          err: pino.stdSerializers.err,
        },
      },
      pino.destination({ sync: false })
    );
  }

  return logger.child({ module });
}

// Default logger instance
export const logger = createLogger();
