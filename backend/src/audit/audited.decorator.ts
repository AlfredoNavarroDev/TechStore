import { SetMetadata } from '@nestjs/common';
import { AuditEntityType } from './entities/audit-log.entity';

export const AUDITED_KEY = 'auditedEntityType';

/**
 * Marca un endpoint mutante como auditable (research.md §14). El AuditInterceptor
 * registra la acción solo si el handler termina en éxito.
 */
export const Audited = (entityType: AuditEntityType) =>
  SetMetadata(AUDITED_KEY, entityType);
