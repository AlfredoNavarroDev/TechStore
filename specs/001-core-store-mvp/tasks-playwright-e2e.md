# Tareas diferidas: Playwright (e2e multi-rol de frontend)

> **NO ejecutar estas tareas salvo que el usuario lo pida explícitamente.** Quedaron fuera de
> `tasks.md` a pedido explícito (2026-08-07). La cobertura de test-first de la constitución
> (Principio III) para carrito/checkout/pagos/fulfillment/auth ya queda cubierta sin esto, vía
> Supertest (backend e2e) + Vitest/RTL (frontend component) — ver `tasks.md`.

Decisión original en `research.md` §1: Playwright para "los flujos e2e críticos (checkout,
login, panel admin, panel delivery)" — multi-rol, multi-página, algo que un test de componente
no cubre. Sigue siendo una buena idea si en algún momento se quiere esa capa; simplemente no es
parte del plan de ejecución por defecto.

## Setup (si se activa)

- [ ] TP001 Instalar `@playwright/test`; crear `frontend/playwright.config.ts` (research.md §1)

## Por user story

- [ ] TP002 [US1] Test Playwright Escenario 1 — catálogo, filtro, búsqueda (`quickstart.md`) en `frontend/e2e/catalog.spec.ts`
- [ ] TP003 [US2] Test Playwright Escenario 2 completo — carrito, mapa de delivery, pago con Stripe, pago fallido (`quickstart.md`) en `frontend/e2e/checkout.spec.ts`
- [ ] TP004 [US3] Test Playwright Escenario 3 — registro, login, historial propio (`quickstart.md`) en `frontend/e2e/account.spec.ts`
- [ ] TP005 [US4] Test Playwright Escenario 4 — panel admin de inventario, 403 para roles no autorizados (`quickstart.md`) en `frontend/e2e/admin-inventory.spec.ts`
- [ ] TP006 [US5] Test Playwright Escenario 5 — asignación delivery, actualización de estado multi-rol (`quickstart.md`) en `frontend/e2e/delivery.spec.ts`
- [ ] TP007 [US7] Test Playwright Escenario 2c — promociones automáticas, precedencia visible en UI (`quickstart.md`) en `frontend/e2e/promotions.spec.ts`

## Notas

- Estas tareas asumen que la story correspondiente en `tasks.md` ya está implementada — no son
  bloqueantes de nada, son una capa de validación adicional.
- Si se activan, agregar `TP00x` al pipeline de CI como paso separado (más lento que
  Supertest/Vitest, no debería bloquear cada commit).
