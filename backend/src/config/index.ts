interface Config {
  port: number | string;
  nodeEnv: string;
  apiUrl: string;
  frontendUrl: string;
  databaseUrl: string | undefined;
  redisUrl: string;
  jwt: {
    secret: string;
    expiration: string;
    refreshSecret: string;
    refreshExpiration: string;
  };
  binance: {
    apiKey: string | undefined;
    apiSecret: string | undefined;
    apiUrl: string;
  };
  email: {
    host: string | undefined;
    port: number;
    secure: boolean;
    user: string | undefined;
    password: string | undefined;
    fromEmail: string;
    fromName: string;
  };
  stripe: {
    secretKey: string | undefined;
    webhookSecret: string | undefined;
  };
  aws: {
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
    s3Bucket: string | undefined;
    region: string;
  };
  onfido: {
    apiKey: string | undefined;
    apiUrl: string;
  };
  bcryptSaltRounds: number;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  fees: {
    maker: number;
    taker: number;
  };
  withdrawalLimits: {
    level0: number;
    level1: number;
    level2: number;
    level3: number;
  };
}

const config: Config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret',
    expiration: process.env.JWT_EXPIRATION || '15m',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'your_refresh_secret',
    refreshExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  },

  // Binance
  binance: {
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    apiUrl: process.env.BINANCE_API_URL || 'https://api.binance.com',
  },

  // Email
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true' || false, // true for 465, false for other ports
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    fromEmail: process.env.EMAIL_FROM || 'noreply@cryptoexchange.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Crypto Exchange',
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  // AWS
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION || 'us-east-1',
  },

  // KYC
  onfido: {
    apiKey: process.env.ONFIDO_API_KEY,
    apiUrl: process.env.ONFIDO_API_URL || 'https://api.onfido.com/v3',
  },

  // Security
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10'),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  // Trading Fees
  fees: {
    maker: parseFloat(process.env.MAKER_FEE || '0.001'),
    taker: parseFloat(process.env.TAKER_FEE || '0.0015'),
  },

  // Withdrawal Limits
  withdrawalLimits: {
    level0: parseFloat(process.env.WITHDRAWAL_LIMIT_LEVEL_0 || '0'),
    level1: parseFloat(process.env.WITHDRAWAL_LIMIT_LEVEL_1 || '2000'),
    level2: parseFloat(process.env.WITHDRAWAL_LIMIT_LEVEL_2 || '50000'),
    level3: parseFloat(process.env.WITHDRAWAL_LIMIT_LEVEL_3 || '999999999'),
  },
};

export default config;
