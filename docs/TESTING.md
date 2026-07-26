# Testing — TechStore

## Backend (NestJS + Jest)

### Unit tests (`*.spec.ts`, junto al archivo que testean)
- **Services**: lógica de negocio aislada — mockear repositorios TypeORM (`getRepositoryToken`), cliente Redis (`@upstash/redis`) y cliente Stripe.
- **Controllers**: mockear services, verificar mapeo request→response y guards aplicados.
- **Guards/Pipes**: `RolesGuard`, rate-limit guard, validación de DTOs.

Cobertura mínima objetivo: 70% en `services/` de cada módulo (lógica de negocio es lo crítico, no getters/DTOs).

### E2E tests (`test/*.e2e-spec.ts`)
- Levantan la app Nest completa (`Test.createTestingModule`) contra:
  - Base de datos de test (Neon branch dedicado o schema separado — **nunca correr e2e contra la DB de desarrollo/producción**)
  - Redis de test (Upstash tiene tier gratis, usar una instancia separada, o mockear `@upstash/redis` en e2e si no se quiere depender de red)
  - Stripe en modo test, webhooks simulados con `stripe-mock` o eventos fixture firmados manualmente
- Flujos críticos a cubrir:
  1. Registro → login → `GET /users/me`
  2. Guest cart → login → merge de carrito
  3. Checkout DELIVERY: crea orden `PENDING` → simula webhook `checkout.session.completed` → orden pasa a `PAID`, stock decrementa
  4. Checkout PICKUP: orden con `pickupLocationId`, sin `shippingFee`
  5. Webhook duplicado (mismo `event.id`) → no duplica efecto (test de idempotencia)
  6. Cupón expirado/agotado → `422`
  7. Rate limit excedido en `/auth/login` → `429`

### Mocks / fixtures
- `test/fixtures/` — payloads de ejemplo (usuario, producto, orden, evento Stripe)
- Cliente Stripe y Redis inyectados vía Nest DI → reemplazables por mocks en `TestingModule` sin tocar código de producción

### Comandos
```bash
npm run test          # unit
npm run test:watch
npm run test:cov
npm run test:e2e
```

## Frontend (Next.js)

MVP: sin suite de testing formal todavía. Al crecer:
- **Unit/component**: Vitest + React Testing Library para componentes de UI (cart, formularios checkout)
- **E2E**: Playwright — flujo completo login → cart → checkout (mockeando Stripe redirect)

Se documenta acá cuando se implemente (fase 9-10 del roadmap).

## CI (pendiente de configurar)

Pipeline sugerido (GitHub Actions) por PR:
1. `lint` (backend + frontend)
2. `test` + `test:e2e` (backend)
3. `build` (backend + frontend)

Bloquear merge a `main` si cualquier paso falla.
