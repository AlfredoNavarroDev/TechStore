# Deployment — TechStore

## Estado

Confirmado: **backend en Render** (plan Free), **frontend en Vercel**, **dominios por defecto** de cada proveedor (`*.onrender.com` / `*.vercel.app`) — sin dominio propio por ahora.

## Ambientes

| Ambiente | Rama | DB (Neon) | Redis (Upstash) | Stripe |
|---|---|---|---|---|
| Desarrollo local | cualquiera | Neon branch `dev` (o principal) | instancia Upstash dev | modo test |
| Staging/Preview | PRs / `main` | Neon branch por PR (branching de Neon) | instancia Upstash dev/staging | modo test |
| Producción | `main` (tag/release) | Neon branch `production` | instancia Upstash producción | modo live |

Neon soporta branching de base de datos por PR — evaluar integración (ej. Neon GitHub Action) para levantar un branch de DB efímero por preview deployment.

## Frontend (Vercel)

- Root directory del proyecto Vercel: `frontend/`
- Framework preset: Next.js (auto-detectado)
- Preview deployments automáticos por PR (branch != `main`)
- Producción: deploy automático en push/merge a `main`

Variables de entorno a configurar en Vercel (Project Settings → Environment Variables, separadas por Production/Preview/Development):
```
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_API_URL
```
`NEXT_PUBLIC_API_URL` apunta al subdominio por defecto de Render (`https://techstore-api.onrender.com/api/v1`). En Preview debe apuntar al backend de staging (no a producción) — evita que un PR de prueba escriba sobre datos reales.

## Backend (Render)

- Tipo de servicio: **Web Service** (Node, plan que soporte proceso long-running — Nest no corre en Functions serverless de Render).
- Build command: `npm ci && npm run build`
- Start command: `npm run start:prod`
- Node version: 20+ (fijar en `package.json` → `engines` o en config de Render)
- Health check path: `GET /health` (agregar en fase de infra) — Render lo usa para saber si el servicio está listo.
- Auto-deploy: activado en push/merge a `main`; considerar un segundo servicio Render (staging) apuntando a otra rama para preview de backend.

Variables de entorno a configurar en Render (Environment):
```
DATABASE_URL
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
JWT_SECRET
JWT_EXPIRES_IN
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
CORS_ORIGIN        # dominio del frontend en Vercel
PORT               # Render inyecta el suyo propio, respetar process.env.PORT
NODE_ENV=production
```

Nota: Render inyecta su propia variable `PORT` — la app Nest debe escuchar en `process.env.PORT` (no hardcodear `3001` en producción).

### Migraciones en deploy

Correr migraciones TypeORM **antes** de levantar la nueva versión del servicio, no vía `synchronize`:
```bash
npm run typeorm migration:run
```
Pipeline sugerido: `build` → `migration:run` contra Neon → `start:prod`. Si una migración falla, el deploy se aborta antes de exponer tráfico a la versión nueva.

### Webhook de Stripe

URL del webhook debe apuntar al subdominio por defecto de Render, ej. `https://techstore-api.onrender.com/api/v1/payments/webhook`, registrada en el Dashboard de Stripe. En desarrollo local usar `stripe listen --forward-to localhost:3001/api/v1/payments/webhook`.

### Cold starts (plan Free de Render)

Plan Free duerme el servicio tras ~15min de inactividad — primer request tras dormir tarda ~30-60s (cold start). **Riesgo real**: si el usuario completa el pago en Stripe justo cuando el backend está dormido, el webhook puede tardar en responder o el frontend puede timeout esperando `checkout-session`.

Mitigación obligatoria mientras se esté en Free:
- **Keep-alive**: job externo (cron-job.org, GitHub Actions scheduled, UptimeRobot) que pega a `GET /health` cada ~10min, evita que el servicio duerma.
- Aun con keep-alive, Render Free puede reiniciar el servicio por otras razones (límite de horas/mes) — monitorear.
- Reevaluar upgrade a plan pago apenas haya tráfico real de pagos en producción (no solo desarrollo/demo).

## CI/CD

Render y Vercel ya auto-despliegan en push a `main` (y previews en PR para Vercel) sin pipeline propio — válido para MVP. Pipeline de GitHub Actions recomendado como gate **antes** de que Render/Vercel desplieguen (evita desplegar código roto):
1. Lint + test + build (backend y frontend) en cada PR
2. Migraciones TypeORM contra Neon corren como parte del `build`/start del servicio en Render (`release` step o script pre-start), no en GitHub Actions directamente
3. Bloquear merge a `main` si el paso 1 falla

## Rollback

- Backend (Render): "Rollback to this deploy" desde el dashboard de Render (mantiene deploys anteriores); si hubo migración breaking, requiere migración de reversa (`migration:revert`) — evaluar antes de aplicar migraciones destructivas en producción.
- Frontend (Vercel): rollback nativo (deployments inmutables, "Promote to Production" de un deploy anterior).
