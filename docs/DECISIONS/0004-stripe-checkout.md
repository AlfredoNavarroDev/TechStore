# 0004 — Stripe Checkout Sessions + webhook idempotente

## Estado
Aceptado

## Contexto
Necesitamos procesar pagos para órdenes con delivery (tarifa fija + dirección) o pickup (sin costo de envío). Opciones evaluadas: Stripe, MercadoPago. Se eligió Stripe por documentación, soporte de Checkout hosted (menor superficie de PCI compliance) y SDKs maduros para Node.

## Decisión
Usar **Stripe Checkout Sessions** (hosted, no Payment Intents custom UI) para el MVP. Backend crea la sesión con el monto final (subtotal + envío si aplica − cupón) y redirige al usuario a Stripe. Confirmación de pago vía **webhook** (`POST /payments/webhook`), no vía redirect de éxito (el redirect es solo UX, no fuente de verdad).

## Consecuencias
- Menor responsabilidad de seguridad/PCI: los datos de tarjeta nunca tocan el backend propio.
- El webhook es la única fuente de verdad de que un pago se completó — se verifica firma con `STRIPE_WEBHOOK_SECRET`.
- Idempotencia obligatoria: Stripe puede reintentar el mismo evento; se guarda `event.id` procesado en Redis (TTL 24h, ver ADR 0002) antes de actualizar `Order.status`.
- `Order` se crea en estado `PENDING` antes de redirigir a Stripe; si el usuario abandona el checkout, la orden queda `PENDING` y debe limpiarse/expirar (tarea de mantenimiento futura).
- Migración a Payment Intents con UI custom queda abierta si se necesita más control de UX de pago más adelante.
