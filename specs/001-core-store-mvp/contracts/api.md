# API Contract (Phase 1): `/api/v1`

Convención: JSON sobre HTTPS, JWT en header `Authorization: Bearer <token>` salvo donde se
indique "público". Los códigos de rol entre corchetes indican quién puede llamar el endpoint;
"cualquiera" incluye invitados.

## Auth

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/register` | público | Crea `User` con rol `USER` (FR-013) |
| POST | `/auth/login` | público | Credentials → JWT |
| POST | `/auth/oauth/google` | público | Recibe perfil verificado de NextAuth/Google → crea/vincula `User` → access+refresh |
| POST | `/auth/refresh` | público (requiere refresh token válido en el body) | Rota: valida `RefreshToken` por hash, revoca el usado, emite par nuevo. Reuso de un token ya revocado → revoca todas las sesiones del usuario (research.md §2) |
| POST | `/auth/logout` | autenticado | Revoca el `RefreshToken` actual |

## Catálogo (público — FR-001..004)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/categories` | cualquiera | Lista categorías |
| GET | `/products?category=&q=&page=` | cualquiera | Catálogo filtrado (categoría) + búsqueda por texto; cada variante incluye precio base y precio efectivo (con `Promotion` aplicada si corresponde, FR-033/034) |
| GET | `/products/:id` | cualquiera | Detalle + variantes + stock efectivo + precio efectivo con promoción |

## Carrito (FR-005..007, FR-020, FR-024)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/cart` | cualquiera (invitado vía cookie/header de sesión, o autenticado) | Carrito actual |
| POST | `/cart/items` | cualquiera | Agregar ítem (valida stock efectivo, FR-006) |
| PATCH | `/cart/items/:id` | cualquiera (dueño del carrito) | Actualizar cantidad |
| DELETE | `/cart/items/:id` | cualquiera (dueño del carrito) | Quitar ítem |
| POST | `/cart/merge` | autenticado | Fusiona carrito de invitado con el del usuario al iniciar sesión (FR-007) |

## Promociones automáticas (FR-032..035)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/promotions` | `ADMIN` | Crea promoción (nombre, tipo, valor, alcance `PRODUCT`\|`BRAND`\|`CATEGORY` + su referencia, vigencia) |
| PATCH | `/promotions/:id` | `ADMIN` | Edita/activa/desactiva una promoción |
| GET | `/promotions` | `ADMIN` | Lista promociones |

## Cupones (FR-027..031)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/cart/coupon` | cualquiera (dueño del carrito) | Body: `code`. Previsualiza el descuento contra el carrito actual (vigencia, mínimo, límites) — no reserva ni consume el uso (research.md §12) |
| DELETE | `/cart/coupon` | cualquiera (dueño del carrito) | Quita el cupón aplicado al carrito |
| POST | `/coupons` | `ADMIN` | Crea cupón (código, tipo, valor, vigencia, límites, mínimo) |
| PATCH | `/coupons/:id` | `ADMIN` | Edita/activa/desactiva un cupón |
| GET | `/coupons` | `ADMIN` | Lista cupones |

## Checkout & Pagos (FR-008..010, FR-021, FR-023..031)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/checkout` | `USER`, rate-limited por `userId` (research.md §9) | Body: `fulfillmentType`, `pickupLocationId?` **o** `deliveryAddress: { formattedAddress, latitude, longitude }` si es delivery (FR-025/026). Revalida stock y crea `StockHold` 15 min en una transacción con lock de fila (FR-024, research.md §3), crea Stripe Checkout Session en PEN (con el descuento del cupón si hay uno aplicado), devuelve URL de pago |
| POST | `/payments/webhook` | público (verificado por firma Stripe; idempotente por `Payment.providerSessionId` único, research.md §4) | Confirma pago → una transacción: crea `Payment`+`Order`+`OrderItem`, decrementa stock real, borra `StockHold` del carrito, revalida y redime el cupón si corresponde (research.md §§6, 12, ACID) |

## Pedidos (FR-011, FR-012, FR-017, FR-018, FR-022)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/orders` | `USER` (propios) / `ADMIN` (todos) / `DELIVERY` (solo asignados) | Historial, filtrado por rol (FR-012, FR-018) |
| GET | `/orders/:id` | dueño, o `ADMIN`, o `DELIVERY` si asignado | Detalle + estado |
| PATCH | `/orders/:id/assign` | `ADMIN` | Asigna `assignedDeliveryUserId` (FR-022) |
| PATCH | `/orders/:id/status` | `ADMIN` (cualquier transición) / `DELIVERY` (solo `OUT_FOR_DELIVERY`→`DELIVERED` en pedidos propios) | Transición de estado (data-model.md, máquina de estados) |

## Inventario / Administración (FR-014..016)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST / PATCH / DELETE | `/categories` | `ADMIN` | Gestión de categorías |
| POST / PATCH / DELETE | `/products` | `ADMIN`, `INVENTORY_MANAGER` | Gestión de productos |
| POST / PATCH / DELETE | `/products/:id/variants` | `ADMIN`, `INVENTORY_MANAGER` | Gestión de variantes + stock |
| GET / POST / PATCH | `/pickup-locations` | `ADMIN` | Gestión de sucursales |
| GET | `/users?role=` | `ADMIN` | Lista usuarios (para asignar como `DELIVERY`) |

## Auditoría (FR-036)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/audit-log?entityType=&entityId=&actorUserId=&page=` | `ADMIN` | Historial de acciones privilegiadas (research.md §14) — filtrable por entidad o por actor |

## Wishlist (fuera de las historias P1/P2, soportado por el modelo)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET / POST / DELETE | `/wishlist` | autenticado | CRUD simple sobre `WishlistItem` |

## Autorización transversal

Todo endpoint mutante pasa por `JwtAuthGuard` + `RolesGuard` (research.md §5); `orders` y
`cart` aplican además un chequeo de propiedad/asignación a nivel de recurso, no solo de rol
(FR-019).
