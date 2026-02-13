import * as Sentry from '@sentry/node';
import 'dotenv/config';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0.1,
});

import app from './app.js';
import { initScheduler } from './jobs/scheduler.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('Server');
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  log.info(`StillNoob API running on port ${PORT}`);
  log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  initScheduler();
});
