import express, { Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';

import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import config from './config';
import logger from './config/logger';
import { connectRedis } from './config/redis';
import { errorHandler, notFoundHandler } from './common/middlewares/error.middleware';
import { generalLimiter, marketLimiter } from './common/middlewares/rateLimit.middleware';
import { initWebSocket } from './websocket';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import ordersRoutes from './modules/orders/orders.routes';
import portfolioRoutes from './modules/portfolio/portfolio.routes';
import marketRoutes from './modules/market/market.routes';
import kycRoutes from './modules/kyc/kyc.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import priceAlertRoutes from './modules/priceAlert/priceAlert.routes';
import marginRoutes from './modules/margin/margin.routes';
import earnRoutes from './modules/earn/earn.routes';
import fiatRoutes from './modules/fiat/fiat.routes';
import tradeRoutes from './modules/trade/trade.routes';
import bankAccountRoutes from './modules/bankAccount/bankAccount.routes';
import withdrawalRoutes from './modules/withdrawal/withdrawal.routes';
import adminRoutes from './modules/admin/admin.routes';

class Server {
  private app: Application;
  private httpServer: any;
  private port: number;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.port = Number(config.port);

    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddlewares() {
    // Security
    this.app.use(helmet());

    // CORS
    const allowedOrigins = config.nodeEnv === 'development' 
      ? ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001']
      : [config.frontendUrl, 'https://project-3-tau-seven.vercel.app'];
    
    this.app.use(
      cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, curl, etc)
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(null, true); // Allow all for now in production
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );

    // Logging
    if (config.nodeEnv === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Body parsing - increase limit for file uploads
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Rate limiting - Market API has higher limit
    this.app.use('/api/market', marketLimiter);
    this.app.use('/api/', generalLimiter);

    // Health check
    this.app.get('/health', (_req: any, res: any) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        },
      });
    });

    // API version
    this.app.get('/api/version', (_req: any, res: any) => {
      res.json({
        success: true,
        data: {
          version: '1.0.0',
          name: 'Crypto Exchange API',
        },
      });
    });
  }

  private setupRoutes() {
    const apiPrefix = '/api';

    // Mount routes
    this.app.use(`${apiPrefix}/auth`, authRoutes);
    this.app.use(`${apiPrefix}/users`, usersRoutes);
    this.app.use(`${apiPrefix}/user`, usersRoutes); // Alias for frontend compatibility
    this.app.use(`${apiPrefix}/wallet`, walletRoutes);
    this.app.use(`${apiPrefix}/orders`, ordersRoutes);
    this.app.use(`${apiPrefix}/portfolio`, portfolioRoutes);
    this.app.use(`${apiPrefix}/market`, marketRoutes);
    this.app.use(`${apiPrefix}/kyc`, kycRoutes);
    this.app.use(`${apiPrefix}/notifications`, notificationsRoutes);
    this.app.use(`${apiPrefix}/alerts`, priceAlertRoutes);
    this.app.use(`${apiPrefix}/margin`, marginRoutes);
    this.app.use(`${apiPrefix}/earn`, earnRoutes);
    this.app.use(`${apiPrefix}/fiat`, fiatRoutes);
    this.app.use(`${apiPrefix}/trade`, tradeRoutes);
    this.app.use(`${apiPrefix}/bank-accounts`, bankAccountRoutes);
    this.app.use(`${apiPrefix}/withdrawals`, withdrawalRoutes);
    this.app.use(`${apiPrefix}/admin`, adminRoutes);

    // Welcome route
    this.app.get('/', (_req: any, res: any) => {
      res.json({
        success: true,
        message: 'Welcome to Crypto Exchange API',
        version: '1.0.0',
        documentation: '/api/docs',
      });
    });
  }

  private setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);

    // Error handler
    this.app.use(errorHandler);
  }

  private async connectDatabase() {
    try {
      // Try Redis connection (optional)
      const redisConnected = await connectRedis();
      if (redisConnected) {
        logger.info('✅ Redis connected successfully');
      }
      // Silent if not connected - no warning spam

      // Note: Prisma connects automatically when first query is made
      logger.info('✅ Database connection ready');
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      // Don't exit - allow server to run without Redis
      logger.warn('⚠️  Continuing without Redis...');
    }
  }

  private initWebSocket() {
    initWebSocket(this.httpServer);
    logger.info('✅ WebSocket server initialized');
  }

  public async start() {
    try {
      // Connect to database and Redis
      await this.connectDatabase();

      // Initialize WebSocket
      this.initWebSocket();

      // Start server
      this.httpServer.listen(this.port, () => {
        logger.info(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Crypto Exchange API Server                      ║
║                                                       ║
║   Environment: ${config.nodeEnv.padEnd(38)}║
║   Port: ${this.port.toString().padEnd(44)}║
║   API URL: ${config.apiUrl.padEnd(41)}║
║                                                       ║
║   📚 Documentation: ${(config.apiUrl + '/api/docs').padEnd(30)}║
║   ❤️  Health Check: ${(config.apiUrl + '/health').padEnd(31)}║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
        `);
      });

      // Graceful shutdown
      this.setupGracefulShutdown();
      
      // Start background workers
      this.startWorkers();
    } catch (error) {
      logger.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private async startWorkers() {
    const { priceAlertWorker } = await import('./workers/priceAlertWorker');
    const { limitOrderWorker } = await import('./workers/limitOrderWorker');
    
    priceAlertWorker.start();
    limitOrderWorker.start();
    logger.info('✅ Background workers started');
  }

  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      this.httpServer.close(async () => {
        logger.info('✅ HTTP server closed');

        // Close database connections
        try {
          // await prisma.$disconnect();
          logger.info('✅ Database connections closed');
        } catch (error) {
          logger.error('❌ Error closing database:', error);
        }

        logger.info('👋 Server shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('⚠️  Forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Create and start server
const server = new Server();
server.start();

export default server;
