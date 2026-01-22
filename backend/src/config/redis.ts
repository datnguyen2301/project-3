/* eslint-disable */
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
/* eslint-enable */

let redisClient: RedisClientType | null = null;
let isConnected = false;

const createRedisClient = () => {
  if (redisClient) return redisClient;

  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: false, // Disable auto-reconnect
    },
  }) as RedisClientType;

  redisClient.on('error', (err: any) => {
    // Only log first error, not spam
    if (isConnected) {
      console.error('❌ Redis connection lost:', err.message);
      isConnected = false;
    }
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis connected');
    isConnected = true;
  });

  return redisClient;
};

export const connectRedis = async () => {
  try {
    const client = createRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    isConnected = true;
    return true;
  } catch (error: any) {
    // Silent fail - only log in debug mode
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_REDIS === 'true') {
      console.warn('⚠️  Redis connection failed:', error.message);
      console.warn('⚠️  Server will run without Redis (caching disabled)');
    }
    isConnected = false;
    return false;
  }
};

export const isRedisConnected = () => isConnected && redisClient?.isOpen;

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

export default { get: () => getRedisClient() };
