const isProduction = process.env.NODE_ENV === 'production';

/**
 * Lightweight structured logger.
 * - Production: JSON lines (for log aggregation, Render, Sentry)
 * - Development: readable "[Module] message" format
 *
 * Usage:
 *   import { createLogger } from '../utils/logger.js';
 *   const log = createLogger('Router:Auth');
 *   log.info('User logged in', { userId: '123' });
 *   log.error('Login failed', err);
 */

function serialize(level, module, message, data) {
  if (isProduction) {
    const entry = { level, module, msg: message, t: new Date().toISOString() };
    if (data instanceof Error) {
      entry.error = { message: data.message, stack: data.stack };
    } else if (data !== undefined) {
      entry.data = data;
    }
    return JSON.stringify(entry);
  }

  // Dev: human-readable
  const prefix = `[${module}]`;
  if (data instanceof Error) {
    return `${prefix} ${message}: ${data.message}\n${data.stack}`;
  }
  if (data !== undefined) {
    const suffix = typeof data === 'string' ? data : JSON.stringify(data);
    return `${prefix} ${message} ${suffix}`;
  }
  return `${prefix} ${message}`;
}

export function createLogger(module) {
  return {
    info(message, data) {
      console.log(serialize('info', module, message, data));
    },
    warn(message, data) {
      console.warn(serialize('warn', module, message, data));
    },
    error(message, data) {
      console.error(serialize('error', module, message, data));
    },
    debug(message, data) {
      if (!isProduction) {
        console.debug(serialize('debug', module, message, data));
      }
    },
  };
}
