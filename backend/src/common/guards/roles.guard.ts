import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../types/jwt-payload.interface';

/**
 * Lee el rol directamente del JWT ya validado por JwtAuthGuard (research.md §5) —
 * sin consulta a DB por request; se acepta hasta 15 min de staleness si un ADMIN
 * cambia el rol de alguien en caliente (aceptable a escala de portafolio).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return requiredRoles.includes(request.user?.role);
  }
}
