# Roadmap — TechStore

## MVP (en progreso, ver CHANGELOG.md para fases detalladas)

- Catálogo electrónica (laptops, PCs, componentes, periféricos) con variantes/stock
- Delivery (tarifa fija) + recojo en múltiples sucursales
- Cart (usuario + invitado)
- Checkout + Stripe
- Cupones, wishlist
- Panel admin básico (productos, órdenes, cupones, sucursales)

## Post-MVP (candidatos, sin priorizar aún)

- **Reviews de producto** — descartado explícitamente del MVP, reevaluar si el negocio lo pide
- **Tracking de envío** — integración con courier, estado de shipment visible al usuario
- **Multi-moneda / multi-región** — si la tienda expande a otros países
- **Búsqueda avanzada** — motor de búsqueda dedicado (Meilisearch/Algolia) si el filtro por Postgres+cache no escala
- **Notificaciones** — email/push en cambios de estado de orden (confirmación, listo para recojo, enviado)
- **Programa de fidelidad/puntos**
- **Comparador de productos** (típico en e-commerce de electrónica: comparar specs de laptops/PCs lado a lado)
- **Financiamiento/cuotas** — común en electrónica de alto ticket, evaluar integración con proveedor de crédito
- **Segunda pasarela de pago** — MercadoPago u otra, detrás de interfaz `PaymentProvider` desacoplada si se requiere
- **Job de limpieza automática** — cancelar órdenes `PENDING` viejas, purgar guest carts (ver `docs/RUNBOOK.md`)
- **Lock distribuido en Redis** para stock — evitar overselling en checkouts concurrentes de alta demanda
- **CI/CD formal** (GitHub Actions) — ver `docs/DEPLOYMENT.md`
- **Testing frontend** (Vitest + Playwright) — ver `docs/TESTING.md`

## Fuera de alcance indefinido

- Marketplace multi-vendedor (hoy es tienda propia, un solo catálogo)
- App móvil nativa (queda como responsive web por ahora)

Este documento se revisa cuando el MVP esté completo, para priorizar la siguiente iteración con datos reales de uso.
