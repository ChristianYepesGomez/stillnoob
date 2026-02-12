import rateLimit from 'express-rate-limit';

/** General API rate limiter */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

/** Stricter limiter for auth endpoints */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

/** Import endpoint limiter */
export const importLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many import requests, please try again later' },
});

/** Analysis endpoint limiter (heavy computation) */
export const analysisLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analysis requests, please try again later' },
});
