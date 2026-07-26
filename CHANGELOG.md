# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [Unreleased]

### Added
- Documentación base del proyecto: `README.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/API.md`, ADRs (`docs/DECISIONS/0001-0004`).
- Definición de alcance MVP: catálogo electrónica (laptops, PCs, componentes), delivery con tarifa fija, recojo en múltiples sucursales, sin módulo de reviews.
- Decisiones de stack: Neon Postgres, Upstash Redis (REST), NextAuth como puente OAuth hacia JWT propio de Nest, Stripe Checkout Sessions.
- Scaffold inicial backend (NestJS 11) y frontend (Next.js 16 App Router) — sin lógica de negocio aún.

### Planned (fases siguientes)
- Fase 1: config Neon + Upstash + validación de env
- Fase 2: `users` + `auth` (JWT, roles, endpoint OAuth)
- Fase 3: `categories` + `products` (+ variantes/stock) con cache-aside
- Fase 4: `pickup-locations`
- Fase 5: `cart` (user + guest en Redis)
- Fase 6: `orders` (delivery/pickup) + checkout
- Fase 7: `payments` (Stripe + webhook idempotente)
- Fase 8: `coupons`, `wishlist`
- Fase 9-10: frontend shop/checkout/account y admin panel
- Fase 11: rate limiting, pulido, seed data, tests
