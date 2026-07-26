import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        ssl: { rejectUnauthorized: false }, // requerido por Neon
        autoLoadEntities: true,
        synchronize: false, // siempre false — todo cambio de schema vía migrations (ver ADR 0001)
      }),
    }),
  ],
})
export class DatabaseModule {}
