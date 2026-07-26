# TechStore

Tienda digital de productos tecnológicos (laptops, PCs, componentes, periféricos), con delivery (tarifa fija) y recojo personal en sucursales.

Proyecto de portafolio — full-stack e-commerce con backend modular, auth, carrito, checkout y pagos.

## Stack

**Backend** (`backend/`)
- NestJS 11 + TypeORM sobre **Neon Postgres**
- **Upstash Redis** (REST) — cache de catálogo, guest cart, rate limiting
- Auth: JWT + roles, puente con NextAuth para OAuth
- Stripe (Checkout Sessions + webhooks)
- API versionada por URI (`/api/v1`)

**Frontend** (`frontend/`)
- Next.js 16 (App Router) + React 19
- NextAuth (Credentials + Google)
- Tailwind CSS

## Estructura

```
TechStore/
├── backend/     # API NestJS
└── frontend/    # Next.js App Router
```

## Modelo de datos (resumen)

`User`, `Category`, `Product` + `ProductVariant`, `PickupLocation`, `Cart`/`CartItem`, `Order`/`OrderItem` (`fulfillmentType`: DELIVERY | PICKUP), `Coupon`, `Payment`, `WishlistItem`.

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
CORS_ORIGIN=http://localhost:3000
PORT=3001
```

### `frontend/.env.local`
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

## Levantar en local

```bash
# Backend
cd backend
npm install
npm run start:dev      # http://localhost:3001

# Frontend
cd frontend
npm install
npm run dev             # http://localhost:3000
```

No requiere Docker: Postgres (Neon) y Redis (Upstash) son servicios cloud.

## Deployment

Backend en **Render**, frontend en **Vercel**, dominios por defecto de cada proveedor.

## Scripts

| Comando | Dónde | Qué hace |
|---|---|---|
| `npm run start:dev` | backend | Nest en modo watch |
| `npm run test` / `test:e2e` | backend | Tests |
| `npm run migration:run` | backend | Corre migraciones TypeORM contra Neon |
| `npm run lint` | backend, frontend | Lint |
| `npm run build` | backend, frontend | Build de producción |
| `npm run dev` | frontend | Next dev server |
