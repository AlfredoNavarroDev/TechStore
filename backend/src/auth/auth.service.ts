import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';
import {
  DuplicateResourceException,
  RefreshTokenReuseException,
} from '../common/exceptions/domain-exceptions';

const BCRYPT_ROUNDS = 10;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async register(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<TokenPair> {
    const existing = await this.usersService.findByEmail(input.email);
    if (existing) {
      throw new DuplicateResourceException('usuario con ese email');
    }
    const passwordHash = await this.hashPassword(input.password);
    // role default USER — no auto-asignable por el propio usuario (FR-013).
    const user = await this.usersService.create({
      email: input.email,
      name: input.name,
      passwordHash,
      role: Role.USER,
    });
    return this.issueTokenPair(user);
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    const valid = await this.comparePassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    return this.issueTokenPair(user);
  }

  /**
   * Verifica el id_token de Google (firma + audiencia = GOOGLE_CLIENT_ID) antes de
   * confiar en el email — nunca se acepta un email/nombre sin verificar (research.md §2).
   */
  async loginWithGoogleProfile(idToken: string): Promise<TokenPair> {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException(
        'No se pudo verificar la cuenta de Google.',
      );
    }

    let user = await this.usersService.findByEmail(payload.email);
    if (!user) {
      // Cuenta creada solo por OAuth: sin passwordHash (data-model.md §User).
      user = await this.usersService.create({
        email: payload.email,
        name: payload.name ?? payload.email,
        passwordHash: null,
        role: Role.USER,
      });
    }
    return this.issueTokenPair(user);
  }

  /** research.md §2 — rotación en cada uso + detección de reuso. */
  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const existing = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    if (existing.revokedAt) {
      // Reuso de un token ya rotado: señal de robo — revoca TODAS las sesiones del usuario.
      await this.refreshTokenRepository.update(
        { userId: existing.userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw new RefreshTokenReuseException();
    }

    const user = await this.usersService.findById(existing.userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    await this.refreshTokenRepository.update(existing.id, {
      revokedAt: new Date(),
    });
    return this.issueTokenPair(user);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.refreshTokenRepository.update(
      { tokenHash },
      { revokedAt: new Date() },
    );
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role });

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const ttlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS') ?? 7;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });
    await this.refreshTokenRepository.save(refreshTokenEntity);

    return { accessToken, refreshToken: rawRefreshToken };
  }

  /**
   * sha256 (determinístico), no bcrypt: el refresh token ya es alta entropía
   * (crypto.randomBytes), no hay riesgo de fuerza bruta offline como con
   * contraseñas — y necesitamos poder buscarlo por hash con un WHERE directo.
   */
  private hashRefreshToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
