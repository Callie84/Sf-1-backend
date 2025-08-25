import Redis from 'redis';
import { logger } from '../utils/logger';

class RedisClient {
  private client: Redis.RedisClientType;

  constructor() {
    this.client = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | null> {
    await this.connect();
    return this.client.get(key);
  }

  async set(key: string, value: string, expiry?: number): Promise<void> {
    await this.connect();
    if (expiry) {
      await this.client.setEx(key, expiry, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.connect();
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    await this.connect();
    const result = await this.client.exists(key);
    return result === 1;
  }

  async flushAll(): Promise<void> {
    await this.connect();
    await this.client.flushAll();
  }

  getClient(): Redis.RedisClientType {
    return this.client;
  }
}

export const redisClient = new RedisClient();