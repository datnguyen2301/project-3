import dotenv from 'dotenv';
dotenv.config();

import logger from '../config/logger';
import { WorkerService } from './worker.service';

const worker = new WorkerService();

logger.info('🚀 Starting worker service...');

worker.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down worker...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down worker...');
  process.exit(0);
});
