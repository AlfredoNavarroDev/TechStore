# Tasks: Core Store & RBAC (Catálogo, Carrito, Checkout, Pedidos, Admin)

**Input**: Design documents from `/specs/001-core-store-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Incluidos. La constitución (Principio III, NON-NEGOTIABLE) exige test-first para
auth/carrito/checkout/pagos/fulfillment — esas tareas de test están marcadas como bloqueantes
("escribir y ver fallar antes de implementar"). Catálogo/inventario/cupones/promociones llevan
test igual (research.md §8) pero sin la marca NON-NEGOTIABLE.

**Playwright (e2e multi-rol de frontend) queda FUERA de este archivo por pedido explícito** —
ver `tasks-playwright-e2e.md`. No se ejecuta salvo que el usuario lo pida directamente; la
cobertura de este archivo se apoya en Supertest (backend e2e) + Vitest/RTL (frontend
component), que siguen cumpliendo Principio III sin Playwright.

**Errores**: ningún error crudo de Postgres/TypeORM debe llegar al cliente — todo pasa por las
excepciones de dominio + el mapeo del `GlobalExceptionFilter` (research.md §15, T017-T018).

**Organization**: Tareas agrupadas por user story (spec.md) para poder implementar y probar
cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: A qué user story pertenece (US1..US7)
- Rutas de archivo exactas en cada descripción, relativas a la raíz del repo

---

## Phase 1: Setup

**Purpose**: Dependencias e infraestructura de proyecto que no dependen de ningún modelo de dominio

- [X] T001 Instalar deps backend: `class-validator`, `class-transformer`, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `@types/passport-jwt`, `bcrypt`, `@types/bcrypt`, `stripe` en `backend/package.json` (plan.md §Primary Dependencies)
- [X] T002 [P] Verificar que `typeorm` resuelve a una versión real de la línea `0.3.x` compatible con `@nestjs/typeorm@^11`; corregir `backend/package.json` si `^1.1.0` no resuelve (research.md §16) — confirmado: `typeorm@1.1.0` real, satisface el rango de peer `^0.3.0 || ^1.0.0-dev` de `@nestjs/typeorm@11.0.3`, sin cambios necesarios
- [X] T003 [P] Instalar deps frontend: `next-auth`, `leaflet`, `react-leaflet`, `@types/leaflet` en `frontend/package.json` (research.md §§2, 11)
- [X] T004 [P] Instalar y configurar Vitest + RTL en frontend: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`; crear `frontend/vitest.config.ts` (research.md §1 — la parte de Playwright de esta decisión queda diferida, ver `tasks-playwright-e2e.md`)
- [X] T005 Configurar bootstrap de `backend/src/main.ts`: `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), `helmet()`, `enableCors()` restringido a `CORS_ORIGIN`, `app.enableShutdownHooks()` (nestjs-pro §main.ts Bootstrap Checklist)
- [X] T006 [P] Configurar `ThrottlerModule` global (in-memory, sin Redis) en `backend/src/app.module.ts` (research.md §9)

**Checkpoint**: proyecto listo para migraciones y código de dominio

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura de la que dependen TODAS las user stories — auth, RBAC, errores,
auditoría, entidades base. Ninguna user story empieza antes de que esta fase esté completa.

**⚠️ CRITICAL**: bloqueante para todo lo demás

- [X] T007 [P] Crear enum `Role` (`USER`, `ADMIN`, `INVENTORY_MANAGER`, `DELIVERY`) en `backend/src/common/enums/role.enum.ts`
- [X] T008 [P] Crear entidad `User` en `backend/src/users/entities/user.entity.ts` (data-model.md §User) con trigger `trg_set_updated_at` en su migración
- [X] T009 [P] Crear entidad `RefreshToken` en `backend/src/auth/entities/refresh-token.entity.ts` (data-model.md §RefreshToken)
- [X] T010 [P] Crear entidad `PickupLocation` en `backend/src/pickup-locations/entities/pickup-location.entity.ts` (data-model.md §PickupLocation)
- [X] T011 [P] Crear entidad `AuditLog` en `backend/src/audit/entities/audit-log.entity.ts` (data-model.md §AuditLog)
- [X] T012 Migración: función `set_updated_at()` + tablas `user`, `refresh_token`, `pickup_location`, `audit_log` + índices `idx_refresh_token_hash` (UNIQUE), `idx_refresh_token_user`, `idx_audit_log_entity`, `idx_audit_log_actor` + `CREATE EXTENSION IF NOT EXISTS pg_trgm;` en `backend/src/database/migrations/` (data-model.md §Índices, plan.md nota pg_trgm) — **archivo escrito, NO ejecutada** (sin `.env`/DB de test todavía a pedido explícito del usuario); correr `npm run migration:run` cuando haya `DATABASE_URL` real
- [X] T013 Implementar hash de contraseña (`bcrypt`) en `backend/src/auth/auth.service.ts` (helper `hashPassword`/`comparePassword`)
- [X] T014 Implementar `JwtStrategy` (`passport-jwt`, valida `Authorization: Bearer`) en `backend/src/auth/strategies/jwt.strategy.ts` y `JwtAuthGuard` en `backend/src/auth/guards/jwt-auth.guard.ts` (research.md §2)
- [X] T015 Implementar decorator `@Roles()` y `RolesGuard` (lee `role` del JWT) en `backend/src/common/decorators/roles.decorator.ts` y `backend/src/common/guards/roles.guard.ts` (research.md §5)
- [X] T016 Implementar `GlobalExceptionFilter` en `backend/src/common/filters/global-exception.filter.ts` y registrarlo en `main.ts` (nestjs-pro §Error Handling)
- [X] T017 Crear jerarquía de excepciones de dominio (`BusinessException` + `InsufficientStockException`, `InvalidFulfillmentException`, `CouponInvalidException`, `CartEmptyException`, `OrderAccessDeniedException`, `DeliveryAddressRequiredException`, `DuplicateResourceException`, `RefreshTokenReuseException`, `PaymentFailedException`) en `backend/src/common/exceptions/` (research.md §15)
- [X] T018 Extender `GlobalExceptionFilter` (T016) para traducir `QueryFailedError` de TypeORM a las excepciones de T017 por `SQLSTATE`/nombre de constraint (`TS001`→stock, `23514`+constraint→fulfillment/stock, `23505`+constraint→duplicado); cualquier error no reconocido → 500 genérico logueado server-side, nunca el mensaje crudo de Postgres al cliente (research.md §15, tabla de mapeo)
- [X] T019 Endpoint `POST /api/v1/auth/register` (crea `User` con rol `USER` por defecto, FR-013; email duplicado → `DuplicateResourceException` vía T018) en `backend/src/auth/auth.controller.ts` + `auth.service.ts`
- [X] T020 Endpoint `POST /api/v1/auth/login` (Credentials, emite access+refresh) en `auth.controller.ts`/`auth.service.ts` (research.md §2)
- [X] T021 Endpoint `POST /api/v1/auth/refresh` (rotación + detección de reuso, `UPDATE` condicional atómico sobre `RefreshToken`; reuso detectado → `RefreshTokenReuseException`) en `auth.controller.ts`/`auth.service.ts` (research.md §2)
- [X] T022 Endpoint `POST /api/v1/auth/logout` (revoca `RefreshToken` actual) en `auth.controller.ts`/`auth.service.ts`
- [X] T023 Implementar `AuditInterceptor` + decorator `@Audited(entityType)` en `backend/src/audit/audit.interceptor.ts` y `backend/src/audit/audited.decorator.ts` (research.md §14) — corre post-éxito, toma `req.user.id`, calcula diff `from`/`to`
- [X] T024 [P] Test unitario: `JwtStrategy`/`RolesGuard` en `backend/src/common/guards/roles.guard.spec.ts`
- [X] T025 [P] Test unitario: mapeo de `QueryFailedError` → excepción de dominio (T018) en `backend/src/common/filters/global-exception.filter.spec.ts`
- [X] T026 [P] Test e2e: rotación y detección de reuso de refresh token en `backend/test/auth.e2e-spec.ts` — escrito; requiere DB de test real para ejecutar (no corrido aún, sin `.env`)

**Checkpoint**: login/roles/errores/auditoría funcionando — las user stories pueden empezar

---

## Phase 3: User Story 1 - Explorar catálogo y buscar productos (Priority: P1) 🎯 MVP

**Goal**: Catálogo público navegable, filtrable por categoría y buscable por texto, sin auth.

**Independent Test**: visitar el catálogo sin sesión, filtrar por categoría, buscar por texto,
ver detalle de un producto con sus variantes y stock.

### Tests for User Story 1

- [ ] T027 [P] [US1] Test Supertest `GET /api/v1/products` (filtro categoría + búsqueda) en `backend/test/products.e2e-spec.ts`
- [ ] T028 [P] [US1] Test Vitest de estado vacío (sin resultados) en `frontend/app/(shop)/__tests__/catalog.test.tsx`

### Implementation for User Story 1

- [ ] T029 [P] [US1] Crear entidad `Category` en `backend/src/categories/entities/category.entity.ts` (data-model.md §Category)
- [ ] T030 [P] [US1] Crear entidad `Product` en `backend/src/products/entities/product.entity.ts` (data-model.md §Product, incluye `brand`)
- [ ] T031 [P] [US1] Crear entidad `ProductVariant` en `backend/src/products/entities/product-variant.entity.ts` (data-model.md §ProductVariant)
- [ ] T032 [US1] Migración: tablas `category`, `product`, `product_variant` + índices `idx_product_category`, `idx_product_brand`, `idx_product_name_trgm` (GIN), `idx_product_variant_product` + `CHECK chk_stock_non_negative` en `backend/src/database/migrations/` (data-model.md §Índices)
- [ ] T033 [US1] Migración de datos semilla (2+ categorías, 2+ productos con variantes y stock) para cumplir `quickstart.md` prerrequisito 4
- [ ] T034 [US1] `CategoriesController`/`CategoriesService`: `GET /api/v1/categories` en `backend/src/categories/`
- [ ] T035 [US1] `ProductsController`/`ProductsService`: `GET /api/v1/products?category=&q=&page=` y `GET /api/v1/products/:id` (precio/stock base, sin promoción/hold aún — se conecta a las views en US2/US7) en `backend/src/products/`
- [ ] T036 [US1] Página de catálogo con filtro de categoría + búsqueda en `frontend/app/(shop)/page.tsx`
- [ ] T037 [US1] Página de detalle de producto con selector de variantes en `frontend/app/(shop)/products/[id]/page.tsx`
- [ ] T038 [US1] Cliente API tipado hacia `/api/v1` en `frontend/lib/api-client.ts`

**Checkpoint**: catálogo público funcional e independientemente demostrable

---

## Phase 4: User Story 2 - Carrito y checkout con pago (Priority: P1) 🎯 MVP

**Goal**: Carrito (invitado + autenticado), reserva de stock, dirección de delivery en mapa,
pago con Stripe, creación de pedido.

**Independent Test**: agregar productos al carrito, elegir pickup o delivery (con dirección de
mapa), pagar con tarjeta de prueba, verificar el pedido resultante.

### Tests for User Story 2 ⚠️ NON-NEGOTIABLE (Principio III — carrito/checkout/pagos)

> Escribir y ver fallar antes de implementar

- [ ] T039 [P] [US2] Test Supertest: checkout con stock insuficiente → `InsufficientStockException` (409), en `backend/test/checkout.e2e-spec.ts`
- [ ] T040 [P] [US2] Test Supertest: checkout con pago fallido → `PaymentFailedException`, carrito intacto (FR-010), en `backend/test/checkout.e2e-spec.ts`
- [ ] T041 [P] [US2] Test e2e: dos requests concurrentes por la última unidad de stock → solo uno gana (research.md §8, "Nota sobre triggers") en `backend/test/checkout.e2e-spec.ts`
- [ ] T042 [P] [US2] Test Vitest: formulario de checkout bloquea con carrito vacío, en `frontend/app/(shop)/checkout/__tests__/checkout.test.tsx`

### Implementation for User Story 2

- [ ] T043 [P] [US2] Crear entidad `Cart`/`CartItem` en `backend/src/cart/entities/cart.entity.ts`, `cart-item.entity.ts` (data-model.md §Cart, §CartItem)
- [ ] T044 [P] [US2] Crear entidad `StockHold` en `backend/src/cart/entities/stock-hold.entity.ts` (data-model.md §StockHold)
- [ ] T045 [P] [US2] Crear entidad `Order`/`OrderItem` en `backend/src/orders/entities/order.entity.ts`, `order-item.entity.ts` (data-model.md §Order, §OrderItem — incluye `cartId`, campos de dirección de delivery, `couponCode`/`discountCents`)
- [ ] T046 [P] [US2] Crear entidad `Payment` en `backend/src/payments/entities/payment.entity.ts` (data-model.md §Payment, `providerSessionId` UNIQUE)
- [ ] T047 [US2] Migración: tablas `cart`, `cart_item`, `stock_hold`, `order`, `order_item`, `payment` + índices (`idx_stock_hold_variant_active`, `idx_stock_hold_cart_variant`, `idx_cart_user_active` único parcial, `idx_cart_item_cart`, `idx_cart_item_variant`, `idx_order_user`, `idx_order_pickup_location`, `idx_order_item_order`, `idx_payment_order`) + `CHECK chk_fulfillment_consistency` en `backend/src/database/migrations/` (data-model.md §Índices)
- [ ] T048 [US2] Migración: función + trigger `trg_order_item_settle_inventory` — `RAISE EXCEPTION ... USING ERRCODE = 'TS001'` en stock insuficiente (data-model.md §Triggers, mapeado por T018) — decremento atómico + borrado de `StockHold` en `backend/src/database/migrations/`
- [ ] T049 [US2] Migración: función + trigger `trg_cart_convert_on_order` (marca `Cart.status = 'CONVERTED'`) en `backend/src/database/migrations/` (data-model.md §Triggers)
- [ ] T050 [US2] Migración: view `v_product_effective_stock` en `backend/src/database/migrations/`; actualizar `ProductsService` (T035) para usarla en el stock mostrado (research.md §3)
- [ ] T051 [US2] `CartService`: carrito de invitado en Redis vía `RedisService` ya existente (`backend/src/cache/redis.service.ts`) + carrito autenticado en Postgres, en `backend/src/cart/cart.service.ts`
- [ ] T052 [US2] Endpoints `GET /api/v1/cart`, `POST /api/v1/cart/items`, `PATCH /api/v1/cart/items/:id`, `DELETE /api/v1/cart/items/:id` en `backend/src/cart/cart.controller.ts` — valida contra `v_product_effective_stock`, insuficiente → `InsufficientStockException` (FR-006)
- [ ] T053 [US2] Endpoint `POST /api/v1/cart/merge` (fusiona invitado→usuario al iniciar sesión, FR-007) en `cart.controller.ts`/`cart.service.ts`
- [ ] T054 [US2] `CheckoutService`: valida carrito no vacío (`CartEmptyException`), `fulfillmentType=DELIVERY` sin dirección → `DeliveryAddressRequiredException`; `SELECT ... FOR UPDATE` sobre `ProductVariant` + `INSERT StockHold` (research.md §3) en `backend/src/cart/checkout.service.ts`
- [ ] T055 [US2] Integración Stripe: crear Checkout Session en PEN en `backend/src/payments/stripe.service.ts` (research.md §4)
- [ ] T056 [US2] Endpoint `POST /api/v1/checkout` (body `fulfillmentType`, `pickupLocationId?` o `deliveryAddress`, rate-limited por `userId`) en `backend/src/cart/checkout.controller.ts`
- [ ] T057 [US2] Endpoint `POST /api/v1/payments/webhook` (verifica firma Stripe, `INSERT Payment`→`Order`→`OrderItem` idempotente, dispara los triggers; pago fallido/cancelado → no crea `Order`) en `backend/src/payments/payments.controller.ts`
- [ ] T058 [US2] Componente de mapa (Leaflet + Nominatim, búsqueda por texto y pin arrastrable) en `frontend/app/(shop)/checkout/components/delivery-map.tsx` (research.md §11)
- [ ] T059 [US2] Página/flujo de carrito y checkout (selección pickup/delivery, mapa, resumen, redirect a Stripe) en `frontend/app/(shop)/cart/page.tsx`, `frontend/app/(shop)/checkout/page.tsx`
- [ ] T060 [US2] Página de confirmación de pedido en `frontend/app/(shop)/orders/[id]/confirmation/page.tsx`

**Checkpoint**: US1 + US2 dan un MVP de compra end-to-end funcional

---

## Phase 5: User Story 3 - Autenticación, cuenta y seguimiento de pedidos (Priority: P2)

**Goal**: Registro/login completo (incluye Google OAuth vía NextAuth), historial de pedidos
propio.

**Independent Test**: registrar cuenta, iniciar sesión, ver historial de pedidos propio y
verificar que no se ve el de otros usuarios.

### Tests for User Story 3 ⚠️ NON-NEGOTIABLE (Principio III — auth)

- [ ] T061 [P] [US3] Test Supertest: `GET /orders/:id` de otro usuario → `OrderAccessDeniedException` (403), en `backend/test/orders.e2e-spec.ts`

### Implementation for User Story 3

- [ ] T062 [US3] Endpoint `POST /api/v1/auth/oauth/google` (crea/vincula `User` desde perfil verificado) en `backend/src/auth/auth.controller.ts`/`auth.service.ts` (research.md §2)
- [ ] T063 [US3] `GET /api/v1/orders` y `GET /api/v1/orders/:id` — filtrado por rol (`USER` ve propios, `ADMIN` todos, `DELIVERY` asignados); acceso fuera de alcance → `OrderAccessDeniedException` en `backend/src/orders/orders.controller.ts`/`orders.service.ts` (FR-012, FR-018)
- [ ] T064 [US3] Configurar NextAuth (`Credentials` → `/auth/login`, `Google` → `/auth/oauth/google`) con callback `jwt` de refresh silencioso en `frontend/app/api/auth/[...nextauth]/route.ts` (research.md §2)
- [ ] T065 [P] [US3] Páginas de login/registro en `frontend/app/(account)/login/page.tsx`, `frontend/app/(account)/register/page.tsx`
- [ ] T066 [US3] Página de historial de pedidos propio en `frontend/app/(account)/orders/page.tsx`

**Checkpoint**: cuenta persistente y trazabilidad de pedidos completas

---

## Phase 6: User Story 4 - Gestión de inventario (Priority: P2)

**Goal**: `ADMIN`/`INVENTORY_MANAGER` gestionan categorías, productos, variantes/stock y
sucursales; `ADMIN` consulta el audit log.

**Independent Test**: como `ADMIN`, crear/editar un producto y su stock, verificar reflejo
inmediato en catálogo; como `USER`/`DELIVERY`, verificar 403.

### Tests for User Story 4

- [ ] T067 [P] [US4] Test Supertest: `USER`/`DELIVERY` reciben 403 en endpoints de inventario, en `backend/test/inventory.e2e-spec.ts`

### Implementation for User Story 4

- [ ] T068 [US4] `POST/PATCH/DELETE /api/v1/categories` (`ADMIN`) con `@Audited('Category')` en `backend/src/categories/categories.controller.ts`
- [ ] T069 [US4] `POST/PATCH/DELETE /api/v1/products` y `/products/:id/variants` (`ADMIN`, `INVENTORY_MANAGER`) con `@Audited('Product')` en `backend/src/products/products.controller.ts`
- [ ] T070 [US4] `GET/POST/PATCH /api/v1/pickup-locations` (`ADMIN`) con `@Audited('PickupLocation')` en `backend/src/pickup-locations/pickup-locations.controller.ts`
- [ ] T071 [US4] `GET /api/v1/users?role=` (`ADMIN`, para asignar `DELIVERY`) en `backend/src/users/users.controller.ts`
- [ ] T072 [US4] Migración: view `v_order_summary` en `backend/src/database/migrations/` (data-model.md §Vistas)
- [ ] T073 [US4] Endpoint `GET /api/v1/audit-log?entityType=&entityId=&actorUserId=&page=` (`ADMIN`) en `backend/src/audit/audit.controller.ts` (FR-036)
- [ ] T074 [US4] Panel admin: gestión de productos/variantes/stock en `frontend/app/admin/products/page.tsx`
- [ ] T075 [US4] Panel admin: gestión de categorías y sucursales en `frontend/app/admin/categories/page.tsx`, `frontend/app/admin/pickup-locations/page.tsx`
- [ ] T076 [US4] Panel admin: vista de audit log en `frontend/app/admin/audit-log/page.tsx`

**Checkpoint**: catálogo administrable sin tocar la base de datos a mano

---

## Phase 7: User Story 5 - Gestión de entregas y estado de pedidos (Priority: P3)

**Goal**: `ADMIN` asigna pedidos delivery; `DELIVERY` ve y actualiza solo sus asignados.

**Independent Test**: `ADMIN` asigna un pedido, `DELIVERY` lo ve y lo marca entregado, el
cliente ve el cambio reflejado.

### Tests for User Story 5 ⚠️ NON-NEGOTIABLE (Principio III — fulfillment)

- [ ] T077 [P] [US5] Test Supertest: `DELIVERY` no puede ver/actualizar pedidos no asignados o de tipo `PICKUP` → `OrderAccessDeniedException`, en `backend/test/delivery.e2e-spec.ts`

### Implementation for User Story 5

- [ ] T078 [US5] `PATCH /api/v1/orders/:id/assign` (`ADMIN`) con `@Audited('Order')` en `backend/src/orders/orders.controller.ts`/`orders.service.ts` (FR-022)
- [ ] T079 [US5] `PATCH /api/v1/orders/:id/status` (`ADMIN` cualquier transición; `DELIVERY` solo `OUT_FOR_DELIVERY→DELIVERED` en propios, fuera de eso → `OrderAccessDeniedException`) con `@Audited('Order')` en `orders.controller.ts`/`orders.service.ts` (FR-017, FR-018, máquina de estados en data-model.md)
- [ ] T080 [US5] Panel `ADMIN`: asignar repartidor a pedidos delivery en `frontend/app/admin/orders/page.tsx`
- [ ] T081 [US5] Panel `DELIVERY`: lista de pedidos asignados + actualizar estado en `frontend/app/delivery/page.tsx`

**Checkpoint**: ciclo de vida completo del pedido, todos los roles operativos

---

## Phase 8: User Story 6 - Cupones de descuento (Priority: P3)

**Goal**: `ADMIN` crea cupones; `USER` los aplica en checkout con validación atómica.

**Independent Test**: crear cupón con 1 uso, aplicarlo y pagar, verificar que un segundo intento
no puede volver a usarlo.

### Tests for User Story 6

- [ ] T082 [P] [US6] Test e2e: dos requests concurrentes redimiendo el último uso de un cupón → solo uno lo obtiene (research.md §§8, 12) en `backend/test/coupons.e2e-spec.ts`
- [ ] T083 [P] [US6] Test Supertest: cupón expirado/desactivado/bajo mínimo → `CouponInvalidException` con motivo específico (FR-029) en `backend/test/coupons.e2e-spec.ts`

### Implementation for User Story 6

- [ ] T084 [P] [US6] Crear entidad `Coupon` en `backend/src/coupons/entities/coupon.entity.ts` (data-model.md §Coupon)
- [ ] T085 [P] [US6] Crear entidad `CouponRedemption` en `backend/src/coupons/entities/coupon-redemption.entity.ts` (data-model.md §CouponRedemption)
- [ ] T086 [US6] Migración: tablas `coupon`, `coupon_redemption` + índice `idx_coupon_redemption_coupon_user` + `CHECK chk_coupon_usage` en `backend/src/database/migrations/`
- [ ] T087 [US6] Migración: función + trigger `trg_order_redeem_coupon` (`UPDATE` condicional atómico, cubre límite total y por usuario) en `backend/src/database/migrations/` (data-model.md §Triggers, research.md §12)
- [ ] T088 [US6] `POST/DELETE /api/v1/cart/coupon` (previsualización, sin reservar uso; motivo de rechazo → `CouponInvalidException(reason)`) en `backend/src/coupons/coupons.controller.ts`/`coupons.service.ts`
- [ ] T089 [US6] `POST/PATCH/GET /api/v1/coupons` (`ADMIN`) con `@Audited('Coupon')` en `coupons.controller.ts` — código duplicado → `DuplicateResourceException`
- [ ] T090 [US6] Actualizar `CheckoutService`/webhook (T054, T057) para pasar `couponCode` al `INSERT Order` (dispara `trg_order_redeem_coupon`) en `backend/src/cart/checkout.service.ts`
- [ ] T091 [US6] Campo de código de cupón en carrito/checkout en `frontend/app/(shop)/cart/components/coupon-input.tsx`
- [ ] T092 [US6] Panel admin: gestión de cupones en `frontend/app/admin/coupons/page.tsx`

**Checkpoint**: cupones funcionando sin exponer sobre-redención bajo concurrencia

---

## Phase 9: User Story 7 - Promociones automáticas por producto/marca/categoría (Priority: P3)

**Goal**: `ADMIN` crea promociones automáticas; el catálogo muestra el precio con descuento sin
acción del usuario.

**Independent Test**: crear promoción por categoría, verificar descuento automático en
catálogo; crear una más específica por producto y verificar que esa gana.

### Tests for User Story 7

- [ ] T093 [P] [US7] Test Supertest: precedencia producto > marca > categoría en `v_product_effective_price` en `backend/test/promotions.e2e-spec.ts`

### Implementation for User Story 7

- [ ] T094 [P] [US7] Crear entidad `Promotion` en `backend/src/promotions/entities/promotion.entity.ts` (data-model.md §Promotion)
- [ ] T095 [US7] Migración: tabla `promotion` + índices parciales `idx_promotion_product`, `idx_promotion_brand`, `idx_promotion_category` en `backend/src/database/migrations/`
- [ ] T096 [US7] Migración: view `v_product_effective_price` (precedencia + desempate por mayor descuento) en `backend/src/database/migrations/` (research.md §13)
- [ ] T097 [US7] Actualizar `ProductsService` (T035) para exponer `effectivePrice` desde `v_product_effective_price` en `backend/src/products/products.service.ts`
- [ ] T098 [US7] `POST/PATCH/GET /api/v1/promotions` (`ADMIN`) con `@Audited('Promotion')` en `backend/src/promotions/promotions.controller.ts`
- [ ] T099 [US7] Mostrar precio base tachado + precio efectivo en catálogo/detalle en `frontend/app/(shop)/page.tsx`, `frontend/app/(shop)/products/[id]/page.tsx`
- [ ] T100 [US7] Panel admin: gestión de promociones en `frontend/app/admin/promotions/page.tsx`

**Checkpoint**: todas las 7 user stories completas e independientemente funcionales

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras que cruzan varias user stories, gates de la constitución

- [ ] T101 [P] Ejecutar `npm run lint` y `npm run build` en `backend/` y `frontend/` sin errores (Development Workflow de la constitución)
- [ ] T102 [P] Confirmar `Order.pickupLocationId`/`assignedDeliveryUserId`/`Promotion.productId`/`categoryId`/`CouponRedemption.*` con estrategia `ON DELETE` de `data-model.md` aplicada en sus migraciones respectivas
- [ ] T103 Ejecutar los 6 escenarios + caso límite de `quickstart.md` de punta a punta contra el entorno de test (manual o vía Supertest — sin Playwright, ver nota arriba)
- [ ] T104 [P] Actualizar `README.md` raíz con cualquier variable de entorno nueva (`STRIPE_*`, `NEXTAUTH_*`, etc. — ya documentadas, confirmar que coinciden con lo implementado)
- [ ] T105 Verificar `/api/docs` (Swagger) gateado o no montado en producción (nestjs-pro §Pre-Deploy Checklist)
- [ ] T106 [P] Revisar que ningún endpoint mutante quede sin `JwtAuthGuard`+`RolesGuard` (barrido manual contra `contracts/api.md` §Autorización transversal)
- [ ] T107 [P] Revisar que ningún endpoint devuelva un error sin pasar por una excepción de dominio (T017) o el mapeo de T018 — barrido manual, ningún `try/catch` silencioso ni mensaje de Postgres crudo en una respuesta

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup — bloquea TODAS las user stories
- **US1 (Phase 3)**: depende solo de Foundational
- **US2 (Phase 4)**: depende de Foundational + entidades `Product`/`ProductVariant` de US1 (T030, T031)
- **US3 (Phase 5)**: depende de Foundational (auth base ya está ahí) + `Order` de US2 (T045) para el historial
- **US4 (Phase 6)**: depende de US1 (extiende `Product`/`Category`) — puede correr en paralelo con US2/US3 si hay más de un desarrollador
- **US5 (Phase 7)**: depende de US2 (`Order` debe existir) + US3 (roles/usuarios)
- **US6 (Phase 8)**: depende de US2 (se integra al checkout, T090)
- **US7 (Phase 9)**: depende de US1 (extiende `ProductsService`)
- **Polish (Phase 10)**: depende de todas las stories que se decida incluir en el release

### Parallel Opportunities

- Todas las tareas `[P]` de Setup y Foundational corren en paralelo entre sí
- Tras Foundational: US1 y US4 pueden empezar en paralelo (US4 solo necesita las entidades de
  catálogo que crea US1, no su implementación completa)
- US6 y US7 son independientes entre sí — solo comparten dependencia de US2/US1 respectivamente
- Dentro de cada story, las entidades marcadas `[P]` (archivos distintos) corren en paralelo;
  los tests marcados `[P]` de una misma story corren en paralelo entre sí

---

## Implementation Strategy

### MVP First

1. Setup + Foundational (T001-T026)
2. US1 — Catálogo (T027-T038)
3. US2 — Carrito y checkout (T039-T060)
4. **STOP y VALIDAR**: Escenarios 1 y 2 de `quickstart.md` de punta a punta — esto ya es una
   tienda funcional con pago real.

### Incremental Delivery

1. Foundational → base lista (incluye manejo de errores desde el día uno, T017-T018)
2. US1 → catálogo demostrable
3. US2 → **MVP de compra completo** (demo/deploy)
4. US3 → cuentas persistentes + historial
5. US4 → panel admin (deja de depender de datos sembrados a mano)
6. US5 → ciclo de delivery completo
7. US6, US7 → cupones y promociones (valor incremental, sin romper nada previo)
8. Polish → gates de la constitución antes de dar por cerrado el release

### Nota sobre triggers y views

Varias tareas de migración (T048-T050, T087, T096) dependen de que existan tablas creadas en
stories anteriores (ej. `trg_order_redeem_coupon` en US6 necesita la tabla `order` de US2) —
esto es intencional y está resuelto por el orden de ejecución de las migraciones, no por el
orden de las user stories en sí; si se paralelizan stories entre desarrolladores, coordinar el
orden de aplicación de migraciones que tocan `"order"` (T047, T048, T049, T087).

### Sobre Playwright

Ver `tasks-playwright-e2e.md` — tareas de e2e multi-rol de frontend, deliberadamente afuera de
este archivo. No ejecutar salvo pedido explícito del usuario.
