import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

// T073 — GET /api/v1/audit-log (ADMIN), FR-036.
@Controller({ path: 'audit-log', version: '1' })
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('page') page?: string,
  ) {
    const [items, total] = await this.auditService.findAll({
      entityType,
      entityId,
      actorUserId,
      page: page ? Number(page) : undefined,
    });
    return { items, total };
  }
}
