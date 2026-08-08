import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { HealthController } from './health/health.controller';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PickupLocationsModule } from './pickup-locations/pickup-locations.module';

/**
 * Módulo raíz. Agrupa configuración (env), acceso a datos (TypeORM/Postgres)
 * y cache (Redis) como módulos globales, más los módulos de dominio.
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CacheModule,
    // Rate limiting en memoria (research.md §9) — sin Redis, no necesita coordinación
    // entre instancias a esta escala de portafolio.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    CommonModule,
    UsersModule,
    AuditModule,
    AuthModule,
    PickupLocationsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
