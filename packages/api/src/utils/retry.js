import { createLogger } from './logger.js';

const log = createLogger('Retry');

/**
 * Returns true if the error is transient and worth retrying.
 * Retries on 429 (rate limit), 5xx (server errors), and network errors.
 * Does NOT retry on 4xx client errors (except 429).
 */
export function isTransientError(err) {
  if (err.response) {
    const status = err.response.status;
    return status === 429 || status >= 500;
  }
  // Network errors, timeouts
  return (
    err.code === 'ECONNABORTED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ENOTFOUND' ||
    err.message?.includes('timeout')
  );
}

/**
 * Retry an async function with exponential backoff.
 * Only retries on transient errors (429, 5xx, network).
 *
 * @param {() => Promise<T>} fn - Async function to execute
 * @param {string} label - Label for log messages
 * @param {object} [opts] - Options
 * @param {number} [opts.maxRetries=3] - Maximum number of retries
 * @param {number} [opts.baseDelayMs=1000] - Base delay in ms (doubles each retry)
 * @returns {Promise<T>}
 */
export async function retryWithBackoff(fn, label, { maxRetries = 3, baseDelayMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isTransientError(err)) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        const status = err.response?.status || err.code || 'unknown';
        log.warn(`${label} failed (${status}), retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        break;
      }
    }
  }
  throw lastError;
}
