import { SPEC_DATA } from '@stillnoob/shared';
import { refreshSpecMeta } from '../services/metaAggregation.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Job:RefreshMeta');

/**
 * Refresh meta data for all specs.
 * Iterates through SPEC_DATA, refreshing each spec's meta with a delay between specs.
 */
export async function refreshAllSpecMeta() {
  const specs = [];
  for (const [className, classSpecs] of Object.entries(SPEC_DATA)) {
    for (const spec of Object.keys(classSpecs)) {
      specs.push({ className, spec });
    }
  }

  log.info(`Starting meta refresh for ${specs.length} specs`);
  let success = 0;
  let failed = 0;

  for (const { className, spec } of specs) {
    try {
      await refreshSpecMeta(className, spec, 'world');
      success++;
      log.info(`Refreshed meta for ${className} - ${spec} (${success + failed}/${specs.length})`);
    } catch (err) {
      failed++;
      log.error(`Failed to refresh ${className} - ${spec}:`, err.message);
    }
    // 2 second delay between specs (WCL + Blizzard handle this comfortably)
    await new Promise(r => setTimeout(r, 2000));
  }

  log.info(`Meta refresh complete: ${success} success, ${failed} failed out of ${specs.length} total`);
  return { success, failed, total: specs.length };
}
