import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';

/**
 * Envuelve ConfigModule de Nest con isGlobal (ConfigService inyectable en
 * cualquier módulo sin re-importar) y validación estricta de process.env
 * al arrancar (ver env.validation.ts).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
