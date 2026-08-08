import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

// JwtAuthGuard y RolesGuard globales (research.md §2/§5) — endpoints públicos
// se marcan con @Public(), roles requeridos con @Roles(...). Orden de guards
// globales sigue el orden de providers: auth primero, roles después.
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // env.validation.ts ya garantiza el formato ("15m", "7d", etc.) — el tipo de
          // @nestjs/jwt exige un literal de plantilla que TypeScript no puede inferir
          // desde ConfigService en runtime, de ahí la aserción.
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '15m') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  providers: [
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, PassportModule],
})
export class CommonModule {}
