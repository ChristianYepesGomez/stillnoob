/**
 * M+ Meta Refresh Job
 *
 * Crawls Blizzard M+ leaderboards for EU+US, then refreshes
 * the M+ meta cache for all 37 specs with gear + talent data.
 */

import { SPEC_DATA } from '@stillnoob/shared';
import { runFullCrawl } from '../services/blizzardMplus.js';
import { refreshMplusSpecMeta } from '../services/mplusMetaAggregation.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('RefreshMplusMeta');

/**
 * Run a full M+ meta refresh:
 * 1. Crawl leaderboards for EU + US
 * 2. Aggregate gear + talents for top 500 per spec
 *
 * @param {string[]} regions - Regions to crawl
 * @returns {Promise<{success: number, failed: number, total: number, crawl: object}>}
 */
export async function refreshAllMplusSpecMeta(regions = ['eu', 'us']) {
  log.info('Starting full M+ meta refresh...');

  // Step 1: Crawl leaderboards
  let crawlResult;
  try {
    crawlResult = await runFullCrawl(regions);
    log.info(
      `Crawl complete: ${crawlResult.totalPlayers} players, ${crawlResult.specCount} specs`,
    );
  } catch (err) {
    log.error('M+ leaderboard crawl failed', err);
    return { success: 0, failed: 0, total: 0, crawl: null };
  }

  // Step 2: Refresh meta for each spec
  const specs = [];
  for (const [className, classSpecs] of Object.entries(SPEC_DATA)) {
    for (const spec of Object.keys(classSpecs)) {
      specs.push({ className, spec });
    }
  }

  log.info(`Refreshing M+ meta for ${specs.length} specs...`);
  let success = 0;
  let failed = 0;

  for (const { className, spec } of specs) {
    try {
      const result = await refreshMplusSpecMeta(className, spec, 'world');
      if (result) {
        success++;
      } else {
        failed++;
      }
      log.info(
        `M+ meta ${result ? 'OK' : 'SKIP'}: ${className} ${spec} (${success + failed}/${specs.length})`,
      );
    } catch (err) {
      failed++;
      log.error(`M+ meta FAIL: ${className} ${spec}:`, err.message);
    }

    // 2-second delay between specs
    await new Promise((r) => setTimeout(r, 2000));
  }

  log.info(
    `M+ meta refresh complete: ${success} success, ${failed} failed out of ${specs.length} total`,
  );

  return { success, failed, total: specs.length, crawl: crawlResult };
}
