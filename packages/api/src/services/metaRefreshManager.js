/**
 * Meta Refresh Manager — handles on-demand and smart meta refreshing.
 *
 * Provides freshness-aware meta retrieval with automatic background refresh
 * when data is stale. Includes debouncing to prevent duplicate refreshes.
 */

import { db } from '../db/client.js';
import { specMetaCache } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import { refreshMplusSpecMeta } from './mplusMetaAggregation.js';
import { refreshSpecMeta } from './metaAggregation.js';
import { getCrawlAge, runFullCrawl } from './blizzardMplus.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('MetaRefreshManager');

/** How old meta data can be before considered stale (12 hours). */
const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000;

/** Minimum time between refresh triggers for the same spec (1 hour). */
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000;

/** Maximum crawl age before re-crawling (6 hours). */
const MAX_CRAWL_AGE_MS = 6 * 60 * 60 * 1000;

// In-memory refresh state
const refreshState = new Map(); // key → { status: 'refreshing'|'done', timestamp }

/**
 * Get meta data for a spec with freshness information.
 * Automatically triggers background refresh if data is stale.
 *
 * @param {string} className
 * @param {string} spec
 * @param {string} region
 * @returns {Promise<{meta: object|null, status: 'fresh'|'stale'|'refreshing', source: string|null}>}
 */
export async function getMetaWithFreshness(className, spec, region = 'world') {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Query DB — prefer M+ source, fall back to raid
  const cached = await db
    .select()
    .from(specMetaCache)
    .where(
      and(
        eq(specMetaCache.className, className),
        eq(specMetaCache.spec, spec),
        eq(specMetaCache.region, region),
        gte(specMetaCache.lastUpdated, sevenDaysAgo),
      ),
    )
    .orderBy(sql`CASE WHEN source = 'mplus' THEN 0 ELSE 1 END`)
    .get();

  if (!cached) {
    // No data at all — trigger refresh
    triggerSpecRefresh(className, spec, 'mplus');
    return { meta: null, status: 'refreshing', source: null };
  }

  const meta = parseCachedMeta(cached);
  const age = Date.now() - new Date(cached.lastUpdated).getTime();
  const source = cached.source || 'raid';

  if (age < STALE_THRESHOLD_MS) {
    return { meta, status: 'fresh', source };
  }

  // Data exists but is stale — trigger background refresh and return stale data
  triggerSpecRefresh(className, spec, source === 'mplus' ? 'mplus' : 'mplus');
  return { meta, status: isRefreshing(className, spec) ? 'refreshing' : 'stale', source };
}

/**
 * Trigger a background refresh for a specific spec.
 * Debounced: won't re-trigger if already refreshing or refreshed recently.
 *
 * @param {string} className
 * @param {string} spec
 * @param {string} source - 'mplus' or 'raid'
 */
export function triggerSpecRefresh(className, spec, source = 'mplus') {
  const key = `${className}:${spec}:${source}`;
  const state = refreshState.get(key);

  // Debounce: skip if currently refreshing or refreshed within cooldown
  if (state) {
    if (state.status === 'refreshing') return;
    if (Date.now() - state.timestamp < REFRESH_COOLDOWN_MS) return;
  }

  refreshState.set(key, { status: 'refreshing', timestamp: Date.now() });

  // Fire-and-forget background refresh
  (async () => {
    try {
      if (source === 'mplus') {
        // Ensure crawl data is reasonably fresh
        if (getCrawlAge() > MAX_CRAWL_AGE_MS) {
          log.info(`Crawl data stale for ${className} ${spec} — re-crawling...`);
          await runFullCrawl(['eu', 'us']);
        }
        await refreshMplusSpecMeta(className, spec, 'world');
      } else {
        await refreshSpecMeta(className, spec, 'world');
      }
      log.info(`On-demand refresh complete: ${className} ${spec} (${source})`);
    } catch (err) {
      log.error(`On-demand refresh failed: ${className} ${spec}`, err.message);
    } finally {
      refreshState.set(key, { status: 'done', timestamp: Date.now() });
    }
  })();
}

/**
 * Check if a spec is currently being refreshed.
 */
export function isRefreshing(className, spec) {
  for (const [key, state] of refreshState) {
    if (key.startsWith(`${className}:${spec}:`) && state.status === 'refreshing') {
      return true;
    }
  }
  return false;
}

/**
 * Parse a cached DB row into the meta object format.
 */
function parseCachedMeta(row) {
  return {
    avgStats: JSON.parse(row.avgStats || '{}'),
    avgItemLevel: row.avgItemLevel,
    commonEnchants: JSON.parse(row.commonEnchants || '{}'),
    commonGems: JSON.parse(row.commonGems || '{}'),
    commonTalents: JSON.parse(row.commonTalents || '{}'),
    sampleSize: row.sampleSize,
    lastUpdated: row.lastUpdated,
  };
}
