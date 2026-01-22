import rateLimit from 'express-rate-limit';
import config from '../../config';

export const generalLimiter = rateLimit({
  windowMs: config.nodeEnv === 'development' ? 60 * 1000 : config.rateLimit.windowMs, // 1 min in dev
  max: config.nodeEnv === 'development' ? 1000 : config.rateLimit.maxRequests, // 1000 in dev
  message: {
    success: false,
    error: {
      code: 'GEN_003',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: config.nodeEnv === 'development' ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1 min in dev, 15 min in prod
  max: config.nodeEnv === 'development' ? 1000 : 50, // 1000 in dev, 50 in prod
  message: {
    success: false,
    error: {
      code: 'GEN_003',
      message: 'Too many authentication attempts, please try again after 15 minutes',
    },
  },
  skipSuccessfulRequests: true,
});

export const tradingLimiter = rateLimit({
  windowMs: config.nodeEnv === 'development' ? 60 * 1000 : 60 * 1000, // 1 minute
  max: config.nodeEnv === 'development' ? 500 : 30, // 500 in dev, 30 in prod
  message: {
    success: false,
    error: {
      code: 'GEN_003',
      message: 'Too many trading requests, please slow down',
    },
  },
});

// Market data limiter - NO limit in development for chart/ticker/orderbook
export const marketLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.nodeEnv === 'development' ? 0 : 300, // 0 = unlimited in dev, 300 in prod
  message: {
    success: false,
    error: {
      code: 'GEN_003',
      message: 'Too many market data requests, please slow down',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'development', // Skip rate limiting in development
});
