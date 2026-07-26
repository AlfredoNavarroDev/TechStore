import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [AppConfigModule, DatabaseModule, CacheModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
