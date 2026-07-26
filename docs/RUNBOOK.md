# Runbook — TechStore

Guía operativa para incidentes/mantenimiento comunes. Actualizar a medida que aparezcan casos reales.

## Webhook de Stripe falla / no llega

**Síntoma**: orden queda en `PENDING` aunque el usuario pagó.

1. Revisar Stripe Dashboard → Developers → Webhooks → ver intentos y respuesta del endpoint.
2. Si el endpoint devolvió error (5xx): revisar logs del backend en el momento del evento.
3. Si la firma falló (401/400): verificar que `STRIPE_WEBHOOK_SECRET` en el ambiente coincide con el configurado en Stripe para ese endpoint.
4. Reenviar el evento manualmente desde el Dashboard de Stripe ("Resend") — es seguro por la idempotencia (ADR 0002/0004), no duplica efectos.
5. Si Stripe nunca lo reintenta y la orden sigue `PENDING`: reconciliar a mano — buscar el `PaymentIntent`/`Checkout Session` en Stripe por `stripeSessionId` guardado en `PAYMENT`, confirmar estado `succeeded`, y forzar transición manual de la orden (endpoint admin o update directo documentado y auditado).

## Orden atascada en PENDING (usuario abandonó checkout)

- Es esperado si el usuario no completa el pago en Stripe.
- Job de mantenimiento (a implementar): cancelar automáticamente órdenes `PENDING` con más de N horas sin webhook de confirmación, liberar reserva de stock si aplica.
- Manual mientras no exista el job: revisar `orders` con `status=PENDING` y `createdAt` viejo, cancelar si corresponde.

## Guest cart huérfano en Redis

- TTL de ~14 días expira solo, no requiere limpieza manual.
- Si se sospecha de crecimiento anómalo de keys `cart:guest:*` en Upstash: revisar métricas de uso en Upstash Dashboard, confirmar que el TTL se está seteando correctamente al crear el guest cart (bug candidato: `SET` sin `EX`).

## Rate limit bloqueando usuarios legítimos

**Síntoma**: reportes de `429` en login/checkout.

1. Revisar configuración de ventana/límite en el guard de `@upstash/ratelimit` (`common/rate-limit.guard.ts`).
2. Si es un usuario/IP específico (ej. NAT compartido de oficina): considerar excepción puntual o ajustar límite.
3. Nunca desactivar rate limiting globalmente para "solucionar" — es control de seguridad, ajustar umbral en su lugar.

## Rotación de secrets (JWT_SECRET, STRIPE keys, etc.)

Ver `docs/SECURITY.md` — sección Secrets. Regla general: rotar en el proveedor, actualizar env var, redeploy, verificar que sesiones/webhooks siguen funcionando con la nueva credencial antes de dar por cerrado.

## Migración de base de datos falla en deploy

1. Revisar el log de `migration:run` — identificar la migración que falló.
2. No forzar `synchronize` como parche — nunca en este proyecto (ver ADR 0001).
3. Si la migración es irreversible y falló a medias: usar Neon branching para probar el fix en una copia antes de reintentar en producción.
4. Una vez corregida, `migration:run` de nuevo (TypeORM trackea migraciones ya aplicadas, no reaplica las exitosas).

## Cache de catálogo desactualizado (producto editado no refleja cambio)

1. Confirmar que la escritura admin (`PATCH /products/:id`) invalida la key de cache correspondiente en Redis.
2. Si el invalidado no ocurre (bug): purgar manualmente la key afectada desde Upstash Dashboard o CLI.
3. Como mitigación mientras se corrige: bajar TTL de cache temporalmente.
