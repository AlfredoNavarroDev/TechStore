# Implementation Plan: Core Store & RBAC (Catálogo, Carrito, Checkout, Pedidos, Admin)

**Branch**: `001-core-store-mvp` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-core-store-mvp/spec.md`

## Summary

MVP de comercio electrónico para TechStore: catálogo público con filtro/búsqueda, carrito
(invitado y autenticado) con reserva de stock de 15 min en checkout, dirección de delivery
seleccionada en mapa (Leaflet/OSM, sin API key), cupones de descuento y promociones
automáticas por producto/marca/categoría, pago vía pasarela
externa (Stripe) en Soles (PEN), gestión de pedidos con historial/estado, RBAC de 4 roles
(`USER`, `ADMIN`, `INVENTORY_MANAGER`, `DELIVERY`) y panel de administración de inventario. Enfoque
técnico: backend NestJS 11 + TypeORM sobre Neon Postgres como única fuente de verdad,
autoridad de autorización y dueño de la reserva de stock transaccional (`StockHold`); Redis
(Upstash) acotado a carrito de invitado; frontend Next.js 16 (App Router) consumiendo
exclusivamente `/api/v1` (Principio I de la constitución).

## Technical Context

**Language/Version**: TypeScript 5.7 (backend, Node.js LTS), TypeScript 5.x (frontend, Next.js
16 / React 19)

**Primary Dependencies**:
- Backend (ya en `package.json`): `@nestjs/common|core|platform-express|config|typeorm` ^11,
  `typeorm` ^1.1.0, `pg`, `@upstash/redis`, `zod`, `reflect-metadata`, `rxjs`.
- Backend (a agregar en Phase 0/implementación, requerido por la constitución y el spec):
  `class-validator` + `class-transformer` (Principio II — validación de DTOs),
  `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` (JWT auth, FR-013/FR-019),
  `bcrypt` (hash de contraseñas), `stripe` (pasarela de pago, FR-009/FR-024).
- Frontend (ya en `package.json`): `next` 16.2.12 (App Router), `react`/`react-dom` 19.2.4,
  `tailwindcss` 4.
- Frontend (a agregar): `next-auth` (Credentials + Google, puente con el JWT del backend, per
  README/constitución); `leaflet` + `react-leaflet` (mapa de selección de dirección de
  delivery, sin API key — research.md §11).

**Storage**: Neon Postgres (fuente de verdad — usuarios, catálogo, carritos, pedidos, pagos,
**y la reserva de stock de checkout vía la entidad `StockHold`**, research.md §3 revisado)
vía TypeORM. Upstash Redis (REST) queda acotado a un solo uso confirmado: **carrito de
invitado**. Cache de catálogo y rate limiting (mencionados como capacidad del stack en la
constitución) quedan diferidos — sin FR/SC que los requiera a esta escala de portafolio, y el
rate limiting de `/checkout` (research.md §9) se resuelve con `@nestjs/throttler` en memoria,
sin Redis.

**Testing**: Backend — Jest (unit, config ya presente en `backend/package.json`) + Supertest
(`test:e2e`, ya presente). Frontend — sin tooling de test instalado aún; debe seleccionarse en
Phase 0 (research.md) antes de implementar, para cumplir el Principio III (test-first en
auth/carrito/checkout/pagos/fulfillment) también en el lado cliente.

**Target Platform**: Web — backend Node.js server (Render), frontend Next.js App Router
(Vercel, SSR/RSC).

**Project Type**: Web application (frontend + backend separados, ya reflejado en la estructura
actual del repo).

**Performance Goals**: Lecturas de catálogo/carrito con p95 < 300ms de la API; creación de
sesión de checkout < 1s (sin contar el tiempo de redirección a la pasarela externa) — objetivos
razonables para el volumen de un proyecto de portafolio, consistentes con SC-001/002/006/007 del
spec.

**Constraints**: Reserva de stock exactamente 15 min (FR-024, vía columna `expiresAt` en
`StockHold` + query filtrada, no TTL de infraestructura — research.md §3); la creación del
hold DEBE ser atómica (`SELECT ... FOR UPDATE` + `INSERT` en una transacción) para evitar
sobreventa por race condition; la confirmación de pago DEBE ser idempotente (constraint único
en `Payment.providerSessionId`, research.md §4) porque Stripe reintenta webhooks; una sola
moneda (PEN, FR-023, sin i18n/multi-currency); autorización por rol
DEBE aplicarse en cada endpoint mutante, nunca solo en la UI (Principio IV / FR-019); el
frontend NO debe acceder a Postgres/Redis directamente, solo vía `/api/v1` (Principio I).
`frontend/AGENTS.md` advierte que Next.js 16 en este repo tiene cambios respecto al
conocimiento de entrenamiento del agente — antes de escribir código de frontend, se debe
instalar dependencias y leer `node_modules/next/dist/docs/` para confirmar convenciones
vigentes (routing, cache, server actions). Búsqueda de catálogo (FR-003) requiere la extensión
`pg_trgm` de Postgres (`data-model.md` §Índices) — Neon la soporta, pero la migración inicial
DEBE incluir `CREATE EXTENSION IF NOT EXISTS pg_trgm;` antes del índice que depende de ella.

**Scale/Scope**: Escala de portafolio/demo (decenas de usuarios concurrentes, no miles) — por
Principio V (Simplicity & Portfolio Scope), no se diseña para escala que el spec no pide.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principio | Evaluación | Estado |
|---|---|---|
| I. API-First Contract | Frontend consume solo `/api/v1` (ver `contracts/api.md`); backend/frontend deployables independientes (Render/Vercel), ya reflejado en estructura del repo. | PASS |
| II. Type Safety End-to-End | TypeORM entities como fuente de verdad (`data-model.md`); DTOs con `class-validator` en cada boundary (a agregar); `any` prohibido salvo webhook crudo de Stripe. | PASS (compromiso de diseño, sin dependencias instaladas aún) |
| III. Test-First (NON-NEGOTIABLE) | Backend ya tiene Jest+Supertest listos. Frontend: research.md §1 fija Vitest + RTL (unit/component) + Playwright (e2e multi-rol) — ambos lados cubiertos antes de implementar. | PASS (resuelto en Phase 0) |
| IV. Security & Data Integrity | JWT+roles en cada endpoint mutante (FR-019, `contracts/api.md` §Autorización transversal); verificación de firma de webhook Stripe (research.md §4); secrets en `.env` (ya gitignorado); validación de todo input externo. | PASS (compromiso de diseño) |
| V. Simplicity & Portfolio Scope | Reserva de stock resuelta dentro de Postgres (`StockHold` + lock de fila, research.md §3) en vez de partir la fuente de verdad entre dos stores; rate limiting de hoarding en memoria, no Redis distribuido (research.md §9); sin microservicios ni capas especulativas; RBAC con guards nativos de NestJS en vez de una librería de políticas (research.md §5). | PASS |
| Stack Constraints | NestJS 11 + TypeORM + Neon + Upstash Redis + Stripe (backend), Next.js 16 + NextAuth + Tailwind (frontend) — coincide exactamente con lo ya scaffoldeado en `backend/` y `frontend/`. | PASS |

**Post-Phase 1**: sin nuevas violaciones introducidas por `data-model.md` o `contracts/api.md`.
Race condition de stock, idempotencia de pago, y ACID de las 4 operaciones multi-escritura
quedaron resueltos en research.md §§3, 4 y 6 (ver también `data-model.md` — entidades
`StockHold` y constraint único en `Payment`). Único riesgo no-arquitectónico anotado: versión
`typeorm@^1.1.0` en `backend/package.json` requiere verificación al instalar (research.md
§15) — no es una violación de principio, es un riesgo de build a confirmar en implementación.

Sin violaciones que requieran justificación en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-core-store-mvp/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── api.md
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── main.ts                     # ya existe
│   ├── app.module.ts               # ya existe
│   ├── config/                     # ya existe (env validation)
│   ├── database/                   # ya existe (TypeORM data-source, migrations)
│   ├── cache/                      # ya existe (Redis service)
│   ├── health/                     # ya existe
│   ├── common/                     # NUEVO: guards de rol, decorador @Roles, filtro de
│   │                                #        excepciones global + excepciones de dominio
│   │                                #        (research.md §15), interceptores
│   ├── audit/                      # NUEVO: AuditLog, AuditInterceptor + @Audited() decorator
│   │                                #        (research.md §14)
│   ├── auth/                       # NUEVO: registro/login, estrategia JWT, puente NextAuth
│   ├── users/                      # NUEVO: entidad User, roles
│   ├── categories/                 # NUEVO
│   ├── products/                   # NUEVO: Product, ProductVariant, stock
│   ├── pickup-locations/           # NUEVO
│   ├── cart/                       # NUEVO: carrito invitado (Redis) + autenticado (DB),
│   │                                #        StockHold transaccional 15 min (Postgres)
│   ├── orders/                     # NUEVO: Order, OrderItem, estado, asignación DELIVERY,
│   │                                #        dirección de delivery
│   ├── coupons/                    # NUEVO: Coupon, CouponRedemption (research.md §12)
│   ├── promotions/                 # NUEVO: Promotion, cálculo de precio efectivo (research.md §13)
│   ├── payments/                   # NUEVO: integración Stripe Checkout + webhook
│   └── database/migrations/        # migraciones TypeORM por módulo (ya existe carpeta);
│                                    # incluye las funciones/triggers de data-model.md §Triggers
│                                    # (TypeORM no genera triggers desde entidades — se escriben
│                                    # a mano en una migración `RunQuery`/`.sql`, ver research.md §6)
└── test/                           # e2e (ya existe carpeta base)

frontend/
├── app/
│   ├── (shop)/                     # NUEVO: catálogo, producto, carrito, checkout (público
│   │                                #        + autenticado), incl. selector de dirección
│   │                                #        con mapa Leaflet (research.md §11)
│   ├── (account)/                  # NUEVO: login/registro, historial de pedidos propio
│   ├── admin/                      # NUEVO: panel ADMIN/INVENTORY_MANAGER (inventario)
│   ├── delivery/                   # NUEVO: panel DELIVERY (pedidos asignados)
│   ├── api/auth/[...nextauth]/     # NUEVO: NextAuth (Credentials + Google)
│   ├── layout.tsx                  # ya existe
│   └── page.tsx                    # ya existe (home → se convierte en landing/catálogo)
└── lib/                            # NUEVO: cliente API tipado hacia /api/v1, helpers de
                                      #        sesión/rol
```

**Structure Decision**: Web application de dos proyectos (Opción 2), ya establecida por el
repo existente. No se introducen proyectos/servicios adicionales — todo módulo nuevo vive
dentro de `backend/src/<dominio>/` o `frontend/app/<área>/`, consistente con Principio V.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
