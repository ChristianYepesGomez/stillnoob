import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { apiLimiter } from './middleware/rateLimit.js';

const app = express();

// Trust proxy when behind reverse proxy (Render, etc.)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('CORS not allowed'));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
import authRoutes from './routes/auth.js';
import characterRoutes from './routes/characters.js';
import reportRoutes from './routes/reports.js';
import analysisRoutes from './routes/analysis.js';
import publicRoutes from './routes/public.js';
import guildRoutes from './routes/guilds.js';
import metaRoutes from './routes/meta.js';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/characters', characterRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/analysis', analysisRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/guilds', guildRoutes);
app.use('/api/v1/meta', metaRoutes);

// 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Sentry error handler (must be before generic error handler)
import * as Sentry from '@sentry/node';
Sentry.setupExpressErrorHandler(app);

// Error handler
import { createLogger } from './utils/logger.js';
const log = createLogger('Express');
app.use((err, req, res, _next) => {
  log.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
