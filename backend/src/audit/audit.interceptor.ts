import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { AUDITED_KEY } from './audited.decorator';
import { AuditEntityType, AuditOperation } from './entities/audit-log.entity';
import { AuthenticatedRequest } from '../common/types/jwt-payload.interface';

type AuditableRequest = AuthenticatedRequest & {
  auditMetadata?: Record<string, { from: unknown; to: unknown }>;
};

interface EntityWithId {
  id?: string;
}

const METHOD_TO_OPERATION: Record<string, AuditOperation> = {
  POST: AuditOperation.CREATE,
  PATCH: AuditOperation.UPDATE,
  PUT: AuditOperation.UPDATE,
  DELETE: AuditOperation.DELETE,
};

/**
 * Corre DESPUÉS de que el handler confirma éxito (evita loguear intentos
 * rechazados por validación/permisos, research.md §14). Los services pueden
 * opcionalmente setear `request.auditMetadata` con el diff from/to antes de
 * terminar, cuando ya lo tenían que leer de todos modos para el UPDATE.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entityType = this.reflector.get<AuditEntityType | undefined>(
      AUDITED_KEY,
      context.getHandler(),
    );
    if (!entityType) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditableRequest>();
    const operation =
      METHOD_TO_OPERATION[request.method] ?? AuditOperation.UPDATE;

    return next.handle().pipe(
      tap((result) => {
        const body = result as EntityWithId | undefined;
        const entityId = body?.id ?? (request.params?.id as string | undefined);
        if (!entityId || !request.user?.sub) {
          return;
        }
        void this.auditService.record({
          actorUserId: request.user.sub,
          entityType,
          entityId,
          operation,
          metadata: request.auditMetadata ?? null,
        });
      }),
    );
  }
}
