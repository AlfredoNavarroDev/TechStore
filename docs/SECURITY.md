# Security — TechStore

## Alcance

Este documento cubre prácticas defensivas del proyecto: manejo de secrets, superficie de ataque, y qué hacer ante un incidente. No cubre pentesting activo ni hardening de infraestructura de terceros (Neon/Upstash/Stripe/Vercel son responsables de su propia seguridad de plataforma).

## Secrets

| Secret | Dónde vive | Rotación |
|---|---|---|
| `DATABASE_URL` (Neon) | env var backend | Regenerar credencial en Neon dashboard si se filtra |
| `UPSTASH_REDIS_REST_TOKEN` | env var backend | Regenerar en Upstash dashboard |
| `JWT_SECRET` | env var backend | Rotar invalida todas las sesiones activas — comunicar antes de rotar en producción |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | env var backend | Rotar desde Stripe dashboard, actualizar webhook endpoint |
| `NEXTAUTH_SECRET` | env var frontend | Rotar invalida sesiones NextAuth activas |
| `GOOGLE_CLIENT_SECRET` | env var frontend | Rotar en Google Cloud Console |

Reglas:
- Nunca commitear `.env` / `.env.local` (ya en `.gitignore` de cada scaffold Nest/Next).
- Nunca loggear valores de secrets ni JWT completos (`Logger` de Nest — cuidado con interceptors que loggean `request.headers`).
- Secrets van solo en el proveedor de hosting (Vercel env vars, etc.), nunca en código ni en `docs/`.
- `.env.example` en cada app documenta **nombres**, nunca valores reales.

## Autenticación / autorización

- Passwords: hash con `bcrypt` (nunca texto plano ni hash reversible), nunca se devuelve `passwordHash` en ninguna response.
- JWT: expiración corta configurable (`JWT_EXPIRES_IN`), `role` embebido en el payload y validado en `RolesGuard` — el rol nunca se confía desde el body/query del request.
- Rutas admin (`@Roles('admin')`) protegidas en backend, no solo ocultas en el frontend.
- Rate limiting (Upstash) en `/auth/login`, `/auth/register`, `/checkout` para mitigar brute-force/credential stuffing.

## Webhooks (Stripe)

- Verificación de firma obligatoria (`STRIPE_WEBHOOK_SECRET`) antes de procesar cualquier evento — nunca confiar en el body sin verificar.
- Endpoint de webhook usa `express.raw()` (no JSON parseado) para poder validar la firma correctamente.
- Idempotencia vía Redis evita reprocesar el mismo evento (ver ADR 0002/0004).

## Datos sensibles

- No se almacenan datos de tarjeta (delegado 100% a Stripe Checkout — fuera de alcance PCI para el backend propio).
- Direcciones de delivery: datos personales — aplicar principio de mínima exposición (no incluir en logs, no exponer en responses de otros usuarios).

## Dependencias

- Evitar agregar dependencias publicadas hace menos de 7 días (riesgo de supply-chain attack no detectado aún).
- Revisar `npm audit` periódicamente en backend y frontend.
- No usar rangos flotantes (`latest`, `*`) en `package.json`.

## Ante un incidente (filtración de secret, brecha sospechada)

1. Rotar el secret comprometido de inmediato (ver tabla arriba).
2. Revisar logs de acceso alrededor del período sospechoso (Neon query logs, Stripe dashboard events, Upstash metrics).
3. Si hay JWT_SECRET comprometido: rotar → invalida todas las sesiones → forzar re-login.
4. Documentar el incidente (causa raíz, impacto, remediación) — no se expone públicamente sin decisión del equipo.

## Fuera de alcance de este proyecto

- No se implementa ni asiste con: bypass de autenticación de terceros, scraping masivo de credenciales, ni herramientas ofensivas. Cualquier hallazgo de seguridad se trata de forma defensiva (fix + documentación).
