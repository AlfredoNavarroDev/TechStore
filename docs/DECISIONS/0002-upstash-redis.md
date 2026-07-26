# 0002 — Upstash Redis (REST) para cache, guest cart, rate limiting e idempotencia

## Estado
Aceptado

## Contexto
Necesitamos Redis para: cache de catálogo, carrito de invitado, rate limiting en endpoints sensibles, e idempotencia de webhooks de Stripe. Opciones: Redis local (Docker/ioredis con conexión TCP), Redis administrado tradicional (ElastiCache), o Upstash (Redis serverless vía REST).

## Decisión
Usar **Upstash Redis** con el SDK `@upstash/redis` (cliente REST, sin conexión TCP persistente), más `@upstash/ratelimit` para rate limiting.

## Consecuencias
- No requiere Docker Compose para Redis; solo `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
- Cliente REST es stateless por request — friendly para entornos serverless/edge si el proyecto migra a ese modelo a futuro.
- Latencia levemente mayor que Redis vía TCP local, aceptable para cache/rate-limit/idempotencia (no es hot path de baja latencia extrema).
- `@upstash/ratelimit` provee algoritmos listos (sliding window, fixed window) sin implementarlos a mano.
- Guest cart y cache de catálogo usan TTL explícito; no hay persistencia garantizada más allá del TTL configurado (aceptable, son datos derivables/recuperables desde Postgres).
