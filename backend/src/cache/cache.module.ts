import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

//Módulo global de cache: expone RedisService a toda la app
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class CacheModule {}
