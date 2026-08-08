import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditController } from './audit.controller';

// AuditInterceptor global (APP_INTERCEPTOR): corre en cada request pero se
// auto-descarta de inmediato si el handler no tiene @Audited() — más simple que
// requerir @UseInterceptors(AuditInterceptor) repetido en cada controller mutante
// (research.md §14, Principio V).
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
