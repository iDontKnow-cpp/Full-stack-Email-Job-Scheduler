import Redis, { RedisOptions } from 'ioredis';
import { env } from '../config/env';

export const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
};

// Main Redis client for general queries and rate limiting
export const redis = new Redis(redisOptions);

// Separate subscriber connection required for BullMQ subscriber
export const redisSubscriber = new Redis(redisOptions);

redis.on('connect', () => {
  console.log(`🔌 Connected to Redis at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

redisSubscriber.on('error', (err) => {
  console.error('❌ Redis subscriber connection error:', err.message);
});

export const createRedisClient = (): Redis => {
  return new Redis(redisOptions);
};

export default redis;
