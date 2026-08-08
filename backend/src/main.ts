import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

/**
 * Punto de entrada de la app. Crea el contexto Nest a partir de AppModule
 * y configura los aspectos transversales del servidor HTTP antes de escuchar.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ConfigService ya está validado (ver env.validation.ts), disponible globalmente.
  const config = app.get(ConfigService);

  app.use(helmet());

  // Todas las rutas quedan bajo /api excepto /health (usado por health checks externos).
  app.setGlobalPrefix('api', { exclude: ['health'] });
  // Versionado por URI: /api/v1/... ; defaultVersion evita romper rutas sin versión explícita.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  // CORS restringido al origen del frontend configurado via env.
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN'),
    credentials: true,
  });

  // whitelist+forbidNonWhitelisted: cualquier campo no declarado en el DTO es rechazado (400),
  // no silenciosamente descartado — evita mass-assignment hacia columnas no expuestas.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Deploys drenan requests en vuelo en vez de cortarlos a mitad (nestjs-pro §Resilience).
  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
}
void bootstrap();
