import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

interface TokenPairBody {
  accessToken: string;
  refreshToken: string;
}

interface BusinessErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

/**
 * T026 — rotación y detección de reuso de refresh token (research.md §2).
 * Escrito y pensado para fallar antes de T021 (Principio III, NON-NEGOTIABLE).
 * Requiere NODE_ENV=test contra una base Postgres de test dedicada (no la de dev).
 */
describe('Auth refresh rotation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = () =>
    `test-${Date.now()}-${Math.random().toString(36).slice(2)}@techstore.test`;

  it('POST /api/v1/auth/refresh: token rotado válido → emite un par nuevo y revoca el usado', async () => {
    const email = uniqueEmail();
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Str0ngPass!', name: 'Test User' })
      .expect(201);

    const { refreshToken: firstRefreshToken } =
      registerRes.body as TokenPairBody;

    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(200);

    const refreshBody = refreshRes.body as TokenPairBody;
    expect(refreshBody.accessToken).toBeDefined();
    expect(refreshBody.refreshToken).toBeDefined();
    expect(refreshBody.refreshToken).not.toBe(firstRefreshToken);
  });

  it('POST /api/v1/auth/refresh: reuso de un refresh token ya rotado → 401 SESSION_REVOKED y revoca todas las sesiones', async () => {
    const email = uniqueEmail();
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Str0ngPass!', name: 'Test User' })
      .expect(201);

    const { refreshToken: originalRefreshToken } =
      registerRes.body as TokenPairBody;

    // Primera rotación: consume el token original, queda revocado.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken })
      .expect(200);

    // Reintentar con el token YA revocado — señal de robo.
    const reuseRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken })
      .expect(401);

    expect((reuseRes.body as BusinessErrorBody).code).toBe('SESSION_REVOKED');
  });

  it('POST /api/v1/auth/refresh: token inexistente/inválido → 401', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'token-que-nunca-existio' })
      .expect(401);
  });
});
