import { validateEnv } from './env.validation';

const validEnv = {
  DATABASE_URL:
    'postgresql://user:pass@ep-xxx.neon.tech/techstore?sslmode=require',
  UPSTASH_REDIS_REST_URL: 'https://us1-example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'token123',
  JWT_SECRET: 'a'.repeat(32),
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_123',
};

describe('validateEnv', () => {
  it('acepta un env válido y aplica defaults', () => {
    const result = validateEnv(validEnv);

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3001);
    expect(result.JWT_EXPIRES_IN).toBe('1d');
    expect(result.CORS_ORIGIN).toBe('http://localhost:3000');
  });

  it('rechaza si falta DATABASE_URL', () => {
    const rest: Record<string, string> = { ...validEnv };
    delete rest.DATABASE_URL;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('rechaza DATABASE_URL que no sea connection string de Postgres', () => {
    expect(() =>
      validateEnv({ ...validEnv, DATABASE_URL: 'mysql://foo' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rechaza JWT_SECRET corto', () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rechaza UPSTASH_REDIS_REST_URL inválida', () => {
    expect(() =>
      validateEnv({ ...validEnv, UPSTASH_REDIS_REST_URL: 'not-a-url' }),
    ).toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it('coacciona PORT de string a number', () => {
    const result = validateEnv({ ...validEnv, PORT: '4000' });
    expect(result.PORT).toBe(4000);
  });
});
