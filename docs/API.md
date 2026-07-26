# API — TechStore

## Estado actual

Documentación de API todavía no generada — el backend está en fase de configuración inicial (ver `CHANGELOG.md`, Fase 1).

## Plan de documentación

A partir de la Fase 2 (`users` + `auth`), cada módulo backend se documenta con `@nestjs/swagger`:
- `@ApiTags('<módulo>')` en cada controller
- `@ApiOperation()` por endpoint
- DTOs decorados con `@ApiProperty()` para request/response
- Autenticación Bearer documentada vía `@ApiBearerAuth()`

Swagger UI servirá en:

```
http://localhost:3001/api/v1/docs
```

## Versionamiento

Estrategia: **versionamiento por URI**, vía `URI Versioning` nativo de Nest (`app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`).

```
/api/v1/products
/api/v1/orders
```

Reglas:
- Toda ruta pública vive bajo `/api/v1/...` desde el día 1 (aunque solo exista v1).
- Breaking change (cambio de shape de response, remoción de campo, cambio de semántica) → nueva versión `v2` del recurso afectado, `v1` se mantiene funcionando hasta deprecación formal.
- Cambios no-breaking (agregar campo opcional, nuevo endpoint) → no requieren bump de versión.
- Deprecación: header `Deprecation: true` + `Sunset: <fecha>` en responses de endpoints deprecados, documentado en Swagger con `@ApiOperation({ deprecated: true })`.

## Convenciones REST

- **Recursos en plural**: `/products`, `/orders`, `/pickup-locations` (kebab-case en rutas multi-palabra).
- **Identificadores**: UUID en path param (`/products/:id`); slugs solo donde aporta SEO/UX (`/products/slug/:slug` si se necesita distinguir de lookup por id).
- **Nesting limitado**: máx 1 nivel (`/orders/:id/items`), evitar rutas anidadas profundas.
- **Verbos HTTP con semántica correcta**:
  - `GET` — lectura, idempotente, cacheable
  - `POST` — creación / acciones no idempotentes (`POST /orders`, `POST /payments/checkout-session`)
  - `PATCH` — actualización parcial (preferido sobre `PUT` para este proyecto)
  - `DELETE` — eliminación (soft-delete vía `isActive`/`deletedAt` donde el dominio lo requiera, ej. `products`, `coupons`)
- **Filtrado, orden y búsqueda** vía query params, no en el path:
  ```
  GET /api/v1/products?categoryId=<uuid>&brand=asus&minPrice=500&maxPrice=2000&sort=-createdAt&q=laptop
  ```
- **Paginación** vía query params `page`/`limit` (o `cursor` para listados de alto volumen como `orders` en admin), respuesta con envelope:
  ```json
  {
    "data": [ ... ],
    "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
  }
  ```
- **Errores**: formato consistente (RFC 7807 *problem+json* simplificado) manejado por un `HttpExceptionFilter` global en `common/`:
  ```json
  {
    "statusCode": 400,
    "error": "Bad Request",
    "message": "El campo 'email' es requerido",
    "path": "/api/v1/auth/register",
    "timestamp": "2026-07-26T12:00:00.000Z"
  }
  ```
- **Códigos de estado HTTP** estrictos: `200` (OK), `201` (creado), `204` (sin contenido, ej. `DELETE`), `400` (validación), `401` (no autenticado), `403` (sin permiso/rol), `404` (no existe), `409` (conflicto, ej. cupón ya usado / stock insuficiente), `422` (entidad válida pero regla de negocio falla), `429` (rate limit excedido), `500` (error no controlado).
- **Autenticación**: header `Authorization: Bearer <jwt>` en todo endpoint protegido; documentado con `@ApiBearerAuth()`.
- **Idempotencia en pagos**: `POST /payments/checkout-session` acepta header `Idempotency-Key` (uuid generado por el cliente) para evitar doble creación de sesión ante reintentos de red; se valida contra Redis (ver ADR 0002).
- **Rate limiting**: responses de endpoints limitados (`/auth/login`, `/auth/register`, `/checkout`) incluyen headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- **CORS**: solo origen del frontend configurado (`NEXT_PUBLIC_API_URL` ↔ backend `CORS_ORIGIN`), sin wildcard `*` en producción.

## Endpoints planeados (alto nivel)

Todos bajo prefijo `/api/v1`.

| Módulo | Endpoints principales |
|---|---|
| `auth` | `POST /auth/register`, `POST /auth/login`, `POST /auth/oauth/verify` |
| `users` | `GET /users/me`, `PATCH /users/me` |
| `categories` | `GET /categories`, `GET /categories/:id`, `POST/PATCH/DELETE /categories/:id` (admin) |
| `products` | `GET /products` (filtros+paginación), `GET /products/:id`, `POST/PATCH/DELETE /products/:id` (admin) |
| `pickup-locations` | `GET /pickup-locations`, `POST/PATCH/DELETE /pickup-locations/:id` (admin) |
| `cart` | `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id` |
| `orders` | `POST /orders` (checkout), `GET /orders` (paginado), `GET /orders/:id` |
| `coupons` | `POST /coupons/validate`, `GET/POST/PATCH/DELETE /coupons` (admin) |
| `payments` | `POST /payments/checkout-session` (requiere `Idempotency-Key`), `POST /payments/webhook` |
| `wishlist` | `GET /wishlist`, `POST /wishlist/:productId`, `DELETE /wishlist/:productId` |

Este archivo se actualiza a mano hasta que Swagger esté montado; luego queda como índice de referencia rápida + guía de convenciones, la fuente de verdad de contratos exactos pasa a ser `/api/v1/docs`.
