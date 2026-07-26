import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { HealthController } from './health/health.controller';

/**
 * Módulo raíz. Agrupa configuración (env), acceso a datos (TypeORM/Postgres)
 * y cache (Redis) como módulos globales, más los controllers de nivel app.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, CacheModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
