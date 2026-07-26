import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService {
  readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      url: this.config.get<string>('UPSTASH_REDIS_REST_URL')!,
      token: this.config.get<string>('UPSTASH_REDIS_REST_TOKEN')!,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, { ex: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Cache-aside: retorna el valor cacheado si existe, si no ejecuta `fn`,
   * cachea el resultado con el TTL dado y lo retorna.
   * Uso principal: cache de catálogo (products/categories), ver ADR 0002.
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await fn();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
