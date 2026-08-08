import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const buildContext = (userRole?: Role): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: userRole ? { sub: 'u1', role: userRole } : undefined,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('canActivate: sin @Roles() en el handler → permite el acceso', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(buildContext(Role.USER))).toBe(true);
  });

  it('canActivate: rol del usuario incluido en @Roles() → permite el acceso', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(buildContext(Role.ADMIN))).toBe(true);
  });

  it('canActivate: rol del usuario NO incluido en @Roles() → deniega el acceso', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(buildContext(Role.USER))).toBe(false);
  });

  it('canActivate: sin request.user (no debería pasar tras JwtAuthGuard, defensivo) → deniega', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(buildContext(undefined))).toBe(false);
  });
});
