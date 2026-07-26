import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Módulo global de cache: expone RedisService a toda la app sin necesidad
 * de importarlo en cada feature module (@Global). Ver ADR 0002 sobre cache-aside.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class CacheModule {}
