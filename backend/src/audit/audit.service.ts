import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditEntityType,
  AuditLog,
  AuditOperation,
} from './entities/audit-log.entity';

export interface RecordAuditInput {
  actorUserId: string;
  entityType: AuditEntityType;
  entityId: string;
  operation: AuditOperation;
  metadata?: Record<string, { from: unknown; to: unknown }> | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async record(input: RecordAuditInput): Promise<void> {
    const entry = this.auditLogRepository.create({
      actorUserId: input.actorUserId,
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      metadata: input.metadata ?? null,
    });
    await this.auditLogRepository.save(entry);
  }

  findAll(filters: {
    entityType?: string;
    entityId?: string;
    actorUserId?: string;
    page?: number;
  }) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = 20;
    return this.auditLogRepository.findAndCount({
      where: {
        ...(filters.entityType
          ? { entityType: filters.entityType as AuditEntityType }
          : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
        ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
