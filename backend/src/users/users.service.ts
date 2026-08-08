import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  create(data: {
    email: string;
    name: string;
    passwordHash: string | null;
    role?: Role;
  }): Promise<User> {
    const user = this.userRepository.create({
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role ?? Role.USER,
    });
    return this.userRepository.save(user);
  }

  findAll(role?: Role): Promise<User[]> {
    return this.userRepository.find({
      where: role ? { role } : {},
      order: { createdAt: 'DESC' },
    });
  }
}
