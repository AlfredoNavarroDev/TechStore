# TechStore

Tienda digital de productos tecnológicos (laptops, PCs, componentes, periféricos), con delivery (tarifa fija) y recojo personal en sucursales.

## Stack

**Backend** (`backend/`)
- NestJS 11 (arquitectura modular)
- TypeORM sobre **Neon Postgres** (cloud, serverless)
- **Upstash Redis** (REST, `@upstash/redis`) — cache de catálogo, guest cart, rate limiting, idempotencia de webhooks
- Auth: JWT + roles (Nest Passport), puente con NextAuth para OAuth
- Pagos: Stripe (Checkout Sessions + webhooks)
- Swagger (`@nestjs/swagger`) para docs de API

**Frontend** (`frontend/`)
- Next.js 16 (App Router) + React 19
- NextAuth (Credentials + Google) — delega emisión de JWT al backend Nest
- Tailwind CSS

## Estructura del repo

```
TechStore/
├── backend/          # API NestJS
├── frontend/         # Next.js App Router
├── docs/             # Documentación técnica (arquitectura, data model, ADRs)
├── CHANGELOG.md
└── README.md
```

Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para el diseño detallado de módulos y flujos, y [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) para el modelo de datos.

## Requisitos previos

- Node.js 20+
- Cuenta Neon (Postgres) — connection string con `sslmode=require`
- Cuenta Upstash (Redis REST) — `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- Cuenta Stripe (modo test) — `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`

## Variables de entorno

### `backend/.env`
```
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/techstore?sslmode=require
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JWT_SECRET=
JWT_EXPIRES_IN=1d
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PORT=3001
```

### `frontend/.env.local`
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Levantar entorno de desarrollo

```bash
# Backend
cd backend
npm install
npm run start:dev      # http://localhost:3001
# Swagger: http://localhost:3001/api/docs (una vez montado en fase 2)

# Frontend
cd frontend
npm install
npm run dev             # http://localhost:3000
```

No requiere Docker: Postgres y Redis son servicios cloud (Neon, Upstash).

## Scripts útiles

| Comando | Dónde | Qué hace |
|---|---|---|
| `npm run start:dev` | backend | Nest en modo watch |
| `npm run test` / `test:e2e` | backend | Tests unitarios / e2e |
| `npm run lint` | backend, frontend | Lint |
| `npm run build` | backend, frontend | Build de producción |
| `npm run dev` | frontend | Next dev server |

## Estado del proyecto

Ver [`CHANGELOG.md`](CHANGELOG.md) para el historial de avances por fase.
