import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from './entities/user.entity';

type PublicUser = Omit<User, 'passwordHash'>;

const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // T071 — ADMIN lista usuarios (ej. para asignar rol DELIVERY a un pedido).
  @Get()
  @Roles(Role.ADMIN)
  async findAll(@Query('role') role?: Role): Promise<PublicUser[]> {
    const users = await this.usersService.findAll(role);
    return users.map(toPublicUser);
  }
}
