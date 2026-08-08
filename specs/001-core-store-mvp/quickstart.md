# Quickstart: Validar Core Store & RBAC

Valida de punta a punta las 5 historias de usuario de `spec.md` una vez implementadas. Referencia
`contracts/api.md` para rutas exactas y `data-model.md` para entidades/estados.

## Prerrequisitos

1. `backend/.env` y `frontend/.env.local` completos (ver `README.md` raíz — incluye
   `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` y credenciales OAuth de Google).
2. `cd backend && npm install && npm run migration:run` (aplica el esquema de
   `data-model.md`).
3. `cd frontend && npm install` — **antes de tocar código de frontend**, leer
   `frontend/node_modules/next/dist/docs/` por la advertencia de `frontend/AGENTS.md`.
4. Sembrar datos mínimos: 2+ categorías, 2+ productos con variantes y stock, 1
   `PickupLocation`, y usuarios de prueba con cada rol (`USER`, `ADMIN`, `INVENTORY_MANAGER`,
   `DELIVERY`).
5. `npm run start:dev` (backend, puerto 3001) y `npm run dev` (frontend, puerto 3000).

## Escenario 1 — Catálogo (US1)

1. Sin iniciar sesión, abrir el catálogo.
2. Filtrar por una categoría → solo aparecen productos de esa categoría.
3. Buscar por texto → solo aparecen coincidencias.
4. Abrir un producto con variantes → ver stock por variante.
5. Buscar un término sin resultados → ver estado vacío (no error).

**Éxito**: SC-001 (encontrar un producto en <30s manualmente).

## Escenario 2 — Carrito y checkout (US2)

1. Agregar un producto al carrito (sin sesión) → ver ítem y total.
2. Actualizar cantidad, quitar un ítem → carrito se actualiza.
3. Intentar agregar más unidades que el stock disponible → sistema lo impide.
4. Ir a checkout → el sistema exige login (FR-021) → iniciar sesión (el carrito de invitado
   se fusiona, FR-007).
5. Elegir `PICKUP` o `DELIVERY`. Si es `DELIVERY`: seleccionar dirección en el mapa (buscar por
   texto y/o arrastrar el pin, FR-025) → confirmar; ver tarifa fija antes de pagar.
6. Pagar con tarjeta de prueba de Stripe.
7. Verificar en `GET /orders/:id`: `status = PAID`, ítems/precios/modalidad/dirección
   coinciden con lo elegido (SC-003, SC-009).
8. Repetir con una tarjeta de prueba que falle → el carrito se conserva intacto (FR-010).

**Éxito**: SC-002 (flujo completo en <3 min), SC-003, SC-004 (revisar que el stock descontado
sea exacto, sin sobreventa), SC-009 (dirección seleccionada en <1 min).

## Escenario 2b — Cupón de descuento (US6)

1. Como `ADMIN`, crear un cupón (`POST /coupons`) con `maxTotalUses: 1`.
2. Como `USER`, aplicarlo en el carrito (`POST /cart/coupon`) → ver el total con descuento.
3. Completar el pago → verificar en `GET /orders/:id` que `discountCents` coincide con el
   descuento del cupón (SC-003).
4. Con un segundo usuario, intentar aplicar y pagar el mismo cupón ya usado → el pago se
   completa pero **sin** el descuento (research.md §12) — nunca se excede `maxTotalUses`
   (SC-008).
5. Probar un cupón expirado/desactivado/bajo el mínimo → `POST /cart/coupon` lo rechaza con el
   motivo específico (FR-029).

## Escenario 2c — Promociones automáticas (US7)

1. Como `ADMIN`, crear una promoción de 15% sobre una categoría (`POST /promotions`).
2. Sin sesión, navegar el catálogo → los productos de esa categoría muestran el precio con
   descuento sin ninguna acción adicional (SC-010).
3. Crear una segunda promoción de 25% sobre un producto específico de esa misma categoría →
   ese producto muestra 25% (la más específica gana, FR-034), el resto de la categoría sigue
   en 15%.
4. Desactivar o expirar la promoción del producto → vuelve a mostrar el 15% de categoría
   automáticamente.
5. Comprar un producto con promoción activa → verificar que `OrderItem.unitPriceCents` en
   `GET /orders/:id` ya refleja el precio con descuento (FR-035).

## Escenario 3 — Cuenta e historial (US3)

1. Registrar una cuenta nueva → rol `USER` por defecto.
2. Iniciar sesión → ver historial de pedidos propio únicamente.
3. Intentar acceder (vía API) al pedido de otro usuario → 403.

**Éxito**: SC-007 (estado de pedido visible en <10s).

## Escenario 4 — Inventario (US4)

1. Iniciar sesión como `ADMIN` o `INVENTORY_MANAGER`.
2. Crear un producto nuevo con variante y stock → aparece de inmediato en el catálogo público.
3. Reducir el stock de una variante a 0 → el catálogo la muestra agotada y bloquea agregarla al
   carrito.
4. Iniciar sesión como `USER` o `DELIVERY` → intentar acceder al panel de inventario → 403.
5. Como `ADMIN`, consultar `GET /audit-log?entityType=Product&entityId=<id>` → aparece el
   `CREATE` y el `UPDATE` de stock del paso 2-3, con el `actorUserId` correcto (FR-036).

## Escenario 5 — Delivery (US5)

1. Como `ADMIN`, tomar un pedido `PAID` con `fulfillmentType = DELIVERY` y asignarlo
   (`PATCH /orders/:id/assign`) a un usuario `DELIVERY`.
2. Iniciar sesión como ese `DELIVERY` → solo ese pedido aparece en su lista (ni pedidos de
   otros repartidores ni pedidos `PICKUP`).
3. Marcar `OUT_FOR_DELIVERY` y luego `DELIVERED` → el historial del cliente (Escenario 3)
   refleja el cambio de inmediato.
4. Como `DELIVERY`, intentar acceder a inventario o a un pedido no asignado → 403.

**Éxito**: SC-005 (100% de accesos fuera de rol denegados), SC-006 (≤3 pasos para actualizar
estado).

## Caso límite a verificar manualmente

- Reserva de stock: agregar el último stock de una variante al carrito, iniciar checkout (sin
  pagar) y esperar >15 min → el stock se libera automáticamente y otro usuario puede
  comprarlo (FR-024, research.md §3).
