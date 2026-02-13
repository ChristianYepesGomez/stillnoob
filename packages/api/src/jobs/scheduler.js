import cron from 'node-cron';
import { scanForNewReports } from './scanReports.js';
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

  log.info('Background jobs initialized (report scan every 30min)');
}
