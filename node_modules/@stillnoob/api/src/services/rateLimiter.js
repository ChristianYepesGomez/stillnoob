/**
 * Token bucket rate limiter for WCL API.
 * WCL enforces ~300 requests/hour for client credentials.
 * This ensures we stay within limits across all consumers.
 */

const MAX_TOKENS = 280; // Leave 20 as buffer
const REFILL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const REFILL_RATE = MAX_TOKENS; // Full refill per hour

let tokens = MAX_TOKENS;
let lastRefill = Date.now();
const waitQueue = [];

function refill() {
  const now = Date.now();
  const elapsed = now - lastRefill;
  const newTokens = Math.floor((elapsed / REFILL_INTERVAL_MS) * REFILL_RATE);
  if (newTokens > 0) {
    tokens = Math.min(MAX_TOKENS, tokens + newTokens);
    lastRefill = now;
  }
}

/**
 * Acquire a token. Resolves immediately if available,
 * waits if rate limited.
 * @returns {Promise<void>}
 */
export async function acquireToken() {
  refill();

  if (tokens > 0) {
    tokens--;
    return;
  }

  // Wait for next refill
  return new Promise((resolve) => {
    waitQueue.push(resolve);
  });
}

/**
 * Process the wait queue when tokens become available.
 * Called periodically.
 */
function processQueue() {
  refill();
  while (waitQueue.length > 0 && tokens > 0) {
    tokens--;
    const resolve = waitQueue.shift();
    resolve();
  }
}

// Check queue every 5 seconds
setInterval(processQueue, 5000);

/**
 * Get current rate limiter status.
 */
export function getRateLimiterStatus() {
  refill();
  return {
    availableTokens: tokens,
    maxTokens: MAX_TOKENS,
    queueLength: waitQueue.length,
  };
}
