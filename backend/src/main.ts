import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

/**
 * Punto de entrada de la app. Crea el contexto Nest a partir de AppModule
 * y configura los aspectos transversales del servidor HTTP antes de escuchar.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ConfigService ya está validado (ver env.validation.ts), disponible globalmente.
  const config = app.get(ConfigService);

  // Todas las rutas quedan bajo /api excepto /health (usado por health checks externos).
  app.setGlobalPrefix('api', { exclude: ['health'] });
  // Versionado por URI: /api/v1/... ; defaultVersion evita romper rutas sin versión explícita.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  // CORS restringido al origen del frontend configurado via env.
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN') });

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
}
void bootstrap();
