import * as Joi from 'joi';

export interface EnvConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  CORS_ORIGIN: string;
}

export const envSchema = Joi.object<EnvConfig, true>({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3001),

  // Neon Postgres
  DATABASE_URL: Joi.string()
    .pattern(/^postgres(ql)?:\/\//)
    .required()
    .messages({
      'string.empty': 'DATABASE_URL es requerido',
      'any.required': 'DATABASE_URL es requerido',
      'string.pattern.base':
        'DATABASE_URL debe ser una connection string de Postgres',
    }),

  // Upstash Redis (REST)
  UPSTASH_REDIS_REST_URL: Joi.string().uri().required().messages({
    'string.uri': 'UPSTASH_REDIS_REST_URL debe ser una URL válida',
    'any.required': 'UPSTASH_REDIS_REST_URL es requerido',
  }),
  UPSTASH_REDIS_REST_TOKEN: Joi.string().required().messages({
    'any.required': 'UPSTASH_REDIS_REST_TOKEN es requerido',
    'string.empty': 'UPSTASH_REDIS_REST_TOKEN es requerido',
  }),

  // Auth
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET debe tener al menos 32 caracteres',
    'any.required': 'JWT_SECRET es requerido',
  }),
  JWT_EXPIRES_IN: Joi.string().default('1d'),

  // Stripe
  STRIPE_SECRET_KEY: Joi.string().required().messages({
    'any.required': 'STRIPE_SECRET_KEY es requerido',
    'string.empty': 'STRIPE_SECRET_KEY es requerido',
  }),
  STRIPE_WEBHOOK_SECRET: Joi.string().required().messages({
    'any.required': 'STRIPE_WEBHOOK_SECRET es requerido',
    'string.empty': 'STRIPE_WEBHOOK_SECRET es requerido',
  }),

  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
}).unknown(true);

/**
 * Valida process.env al boot de la app. Nest llama esto desde ConfigModule.forRoot({ validate }).
 * Si falla, lanza y aborta el arranque — preferible a descubrir una env var faltante en producción.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result: Joi.ValidationResult<EnvConfig> = envSchema.validate(config, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (result.error) {
    const issues = result.error.details
      .map((d) => `  - ${d.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }

  return result.value;
}
