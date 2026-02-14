import cron from 'node-cron';
import { scanForNewReports } from './scanReports.js';
import { refreshAllSpecMeta } from './refreshMeta.js';
import { refreshAllMplusSpecMeta } from './refreshMplusMeta.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Scheduler');

/**
 * Initialize all background jobs.
 * Called once when the server starts.
 */
export function initScheduler() {
  // Only run background jobs if WCL credentials are configured
  if (!process.env.WCL_CLIENT_ID || !process.env.WCL_CLIENT_SECRET) {
    log.info('WCL credentials not configured, background scanning disabled');
    return;
  }

  // Scan for new reports every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const result = await scanForNewReports();
      if (result.failed > 0) {
        log.warn(`Scan finished with ${result.failed} failures — check logs for details`);
      }
    } catch (err) {
      log.error('Report scan crashed', err);
    }
  });

  // Refresh raid meta data daily at 4:00 AM UTC
  cron.schedule('0 4 * * *', async () => {
    log.info('Daily raid meta refresh started');
    try {
      const result = await refreshAllSpecMeta();
      if (result.failed > 0) {
        log.warn(`Meta refresh finished with ${result.failed} failures — check logs for details`);
      }
    } catch (err) {
      log.error('Daily raid meta refresh failed', err);
    }
  });

  // Refresh M+ meta twice weekly — Wed + Sun at 5:00 AM UTC (after weekly reset)
  if (process.env.BLIZZARD_CLIENT_ID && process.env.BLIZZARD_CLIENT_SECRET) {
    cron.schedule('0 5 * * 0,3', async () => {
      log.info('M+ meta refresh started');
      try {
        const result = await refreshAllMplusSpecMeta();
        log.info(
          `M+ meta refresh done: ${result.success} success, ${result.failed} failed out of ${result.total}`,
        );
      } catch (err) {
        log.error('M+ meta refresh failed', err);
      }
    });

    log.info(
      'Background jobs initialized (report scan every 30min, raid meta daily 4AM, M+ meta Wed+Sun 5AM UTC)',
    );
  } else {
    log.info(
      'Background jobs initialized (report scan every 30min, raid meta daily 4AM — M+ meta disabled: no Blizzard credentials)',
    );
  }
}
