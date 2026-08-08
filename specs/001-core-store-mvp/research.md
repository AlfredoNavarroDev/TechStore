# Phase 0 Research: Core Store & RBAC

## 1. Frontend testing tooling

**Decision**: Vitest + React Testing Library para unit/component tests; Playwright para los
flujos e2e críticos (checkout, login, panel admin, panel delivery).

**Rationale**: Next.js 16 documenta Vitest como el runner recomendado para App Router/RSC
(más rápido que Jest con ESM nativo, sin configuración de transformadores adicional); RTL es
el estándar para testear componentes React por comportamiento en vez de implementación.
Playwright cubre los flujos multi-página/multi-rol (login → carrito → checkout → confirmación)
que un test de componente no puede validar solo. Antes de instalar, confirmar contra
`node_modules/next/dist/docs/` (una vez corrido `npm install`) que no cambió la recomendación
oficial para esta versión exacta (16.2.12), por la advertencia de `frontend/AGENTS.md`.

**Alternatives considered**:
- Jest + RTL: consistente con el backend, pero Next 16 App Router tiene fricción conocida con
  Jest y ESM/RSC; requeriría configuración adicional sin beneficio claro.
- Cypress: capaz para e2e, pero Playwright ya cubre el caso y tiene mejor soporte para
  multi-rol/multi-contexto (útil para probar ADMIN vs DELIVERY vs USER en paralelo).

## 2. Estrategia de autenticación (JWT + refresh token + NextAuth)

**Decision**: El backend es la única autoridad de autenticación/roles (Principio I). Emite dos
tokens en `login`/`register`/`oauth/google`:

- **Access token**: JWT firmado (HS256, `JWT_SECRET`), payload `{ sub, role, iat, exp }`,
  vida corta = **15 min**. Se valida en cada request con una `JwtStrategy` de
  `passport-jwt` (extrae de `Authorization: Bearer`, verifica firma+expiración) detrás de un
  `JwtAuthGuard` global. `RolesGuard` lee el `role` directamente del payload (evita una
  consulta a DB por request) — se acepta hasta 15 min de staleness si un `ADMIN` cambia el rol
  de alguien en caliente (aceptable para el alcance de portafolio, Principio V).
- **Refresh token**: string opaco aleatorio (no JWT), vida larga = **7 días**. Se persiste
  **hasheado** (bcrypt/sha256) en una tabla `RefreshToken` (ver `data-model.md`) junto al
  `userId`, `expiresAt` y `revokedAt`. El valor en claro solo existe en la respuesta al
  cliente, nunca se guarda en texto plano en el servidor.

**Flujo de refresh y rotación**: `POST /api/v1/auth/refresh` recibe el refresh token, lo busca
por hash en `RefreshToken`. Si no existe, expiró o `revokedAt` no es null → 401. Si es válido:
se marca `revokedAt` en el token usado y se emite un **par nuevo** (access + refresh) —
rotación en cada uso. **Detección de reuso**: si llega un refresh token que ya está marcado
`revokedAt` (alguien reenvía uno viejo — señal de robo), se revocan TODOS los refresh tokens
activos de ese usuario y se fuerza login de nuevo (evento de seguridad, Principio IV).
`POST /api/v1/auth/logout` revoca el refresh token actual.

**Dónde vive el refresh token en el navegador**: backend (Render) y frontend (Vercel) son
dominios distintos, así que una cookie `httpOnly` puesta por el backend requeriría
`SameSite=None; Secure` cross-site (frágil, y algunos navegadores la bloquean en modos
restrictivos). En vez de eso, el par de tokens se devuelve en el **body JSON** de
login/refresh y NextAuth los guarda dentro de su **propio** JWT de sesión cifrado (que sí es
`httpOnly` en el dominio del frontend, mecanismo ya provisto por NextAuth). El callback `jwt`
de NextAuth revisa en cada request si el access token está por expirar y, si es así, llama a
`/api/v1/auth/refresh` server-side (nunca expuesto a JS del navegador) y actualiza la sesión
con el par nuevo — refresh silencioso, transparente para el usuario. El provider `Google` hace
el OAuth y luego llama a `POST /api/v1/auth/oauth/google` (crea/vincula el `User`) que devuelve
el mismo par access+refresh.

**Rationale**: Mantiene a Postgres (vía backend) como única fuente de verdad de
sesiones/roles; la rotación + detección de reuso da revocación real (un JWT plano de larga
vida no se puede invalidar antes de tiempo) sin infraestructura nueva — reutiliza Postgres, no
Redis ni una tabla de sesiones aparte (Principio V). Guardar los tokens dentro de la sesión
cifrada de NextAuth evita la fragilidad de cookies cross-site entre Render y Vercel.

**Alternatives considered**:
- NextAuth como única autoridad (JWT propio de NextAuth, backend solo valida su firma): más
  simple al inicio, pero acopla el backend a la config de NextAuth y complica servir otros
  clientes (ej. una futura app móvil) — rechazado por Principio I.
- Refresh token como JWT largo sin persistencia en DB: no permite revocar sesiones
  individuales (logout real, detección de robo) — rechazado por Principio IV.
- Cookie `httpOnly` cross-site puesta directamente por el backend: viable pero frágil por
  `SameSite=None` entre dominios distintos (Render/Vercel) y navegadores que la bloquean —
  rechazado en favor de la sesión cifrada de NextAuth ya disponible en el stack.

## 3. Reserva de stock (checkout, 15 min — FR-024) — **REVISADO: Postgres, no Redis**

> Esta decisión **reemplaza** el diseño original (Redis con TTL) por una race condition real
> que ese diseño no resolvía — ver "Race Condition" abajo. El uso de Redis para holds queda
> descartado; Redis sigue siendo necesario solo para el carrito de invitado (research.md más
> abajo, sección de alcance de Redis).

**Decision**: Se agrega la entidad `StockHold` (Postgres — ver `data-model.md`): `id`,
`cartId`, `productVariantId`, `quantity`, `expiresAt` (`createdAt` + 15 min). La disponibilidad
efectiva de una variante se calcula como:

```sql
stockQuantity - COALESCE(SUM(quantity) FROM stock_holds
                          WHERE productVariantId = :id AND expiresAt > now(), 0)
```

Al iniciar el checkout, se crea el `StockHold` dentro de una **transacción corta** con lock de
fila:

1. `SELECT stock_quantity FROM product_variants WHERE id = :id FOR UPDATE` (bloquea la fila
   solo por la duración de esta transacción — milisegundos, no los 15 min del hold).
2. Calcular holds activos (`expiresAt > now()`) para esa variante, dentro de la misma
   transacción (ve un snapshot consistente gracias al lock del paso 1).
3. Si `quantity solicitada <= stockQuantity - holds activos` → `INSERT` el `StockHold` →
   `COMMIT`. Si no → `ROLLBACK` y responder "stock insuficiente".

**Expiración**: no requiere TTL nativo ni cron — un hold vencido simplemente deja de contar en
el `WHERE expiresAt > now()` de la query de disponibilidad; el stock vuelve a estar disponible
de inmediato sin acción manual. Un job de limpieza periódico (borrar `StockHold` con
`expiresAt` muy en el pasado) es solo higiene de tabla, no un requisito de corrección.

**Confirmación de pago**: el webhook de Stripe, dentro de **una sola transacción**, hace
`INSERT Payment` → `INSERT Order` → `INSERT OrderItem` por cada ítem. El decremento real de
`stockQuantity` y el borrado del/los `StockHold` de ese carrito **ya no los hace el service** —
los ejecuta el trigger `trg_order_item_settle_inventory` (`data-model.md` §Triggers) disparado
por cada `INSERT OrderItem`, con el mismo patrón de `UPDATE` condicional atómico que este
research ya usaba a nivel de service (research.md §6, "ACID" — actualizado).

### Race Condition (por qué se descartó el diseño original con Redis)

El diseño original calculaba "disponibilidad efectiva" como una **lectura** contra Redis
(`stock.quantity - Σ holds`) y luego, si alcanzaba, hacía un **escritura** separada (crear la
key del hold) — un patrón *check-then-act* clásico. Si dos requests piden la última unidad de
una variante en la misma ventana de milisegundos, ambos pueden leer "1 disponible" **antes**
de que cualquiera escriba su hold, y ambos pasan la validación → sobreventa (viola FR-006/
FR-020/SC-004). El Redis REST de Upstash no ofrece transacciones multi-comando fáciles de
componer con Postgres (que es donde vive el stock real), así que el check y el act nunca eran
verdaderamente atómicos entre los dos stores.

El diseño revisado resuelve esto con `SELECT ... FOR UPDATE`: el lock de fila de Postgres hace
que un segundo request para la misma variante **espere** a que el primero termine su
transacción (check+insert) antes de poder leer un estado consistente — no hay ventana entre
"leer disponibilidad" y "reservar" en la que otro request pueda colarse. Es el mismo patrón que
ya se usa para el conflicto de "última unidad" en el Edge Case del spec.

**Rationale**: correcto (ACID nativo de Postgres) en vez de "probablemente correcto" (dos
stores separados sin transacción compartida); el lock es breve (milisegundos), no reintroduce
el problema original de "transacción abierta 15 minutos" que motivó ir a Redis en primer lugar
— ese problema se evita porque el *hold* como dato vive 15 min, pero el *lock* solo vive lo que
tarda el check-and-insert.

**Alternatives considered**:
- Redis con Lua/`EVAL` para hacer el check-and-set atómico: técnicamente resuelve la race
  condition, pero mantiene el stock "partido" entre dos fuentes de verdad (Redis para holds,
  Postgres para stock real) — cualquier bug de sincronización entre ambas es un modo de fallo
  adicional que el diseño en un solo store no tiene. Rechazado por Principio V (menos partes
  móviles) y porque el problema de ACID (abajo) se resuelve mejor en un único motor
  transaccional.
- Columna `reserved_quantity` en `ProductVariant` + cron de limpieza: sigue teniendo el mismo
  riesgo de *check-then-act* si no se actualiza dentro de una transacción con lock — no
  resuelve la race condition por sí sola; la tabla `StockHold` + `FOR UPDATE` sí.
- Decrementar stock real al agregar al carrito: bloquearía inventario para usuarios que solo
  están explorando (nunca llegan a pagar) — contradice FR-020 (revalidar recién en checkout).

## 4. Pasarela de pagos

**Decision**: Stripe Checkout Sessions (ya definido en la constitución). El backend crea la
Checkout Session al confirmar el checkout (con line items en PEN, FR-023) y solo crea el
`Order` en estado `PAID` cuando llega y se verifica el webhook `checkout.session.completed`
(firma verificada con `STRIPE_WEBHOOK_SECRET`, Principio IV). El pago fallido/cancelado no
genera `Order`; el carrito permanece intacto (FR-010).

**Rationale**: Ya está fijado en `Technology Stack Constraints` de la constitución — no hay
decisión de framework que tomar aquí, solo el patrón de integración (Checkout Session +
webhook, no Payment Intents manuales) por ser el flujo de menor superficie de implementación.

**Alternatives considered**: Stripe Payment Intents con formulario propio — más control de UI,
pero más superficie de PCI/validación a mantener; innecesario para el alcance del spec.

### Idempotencia del webhook y creación de `Order`

**Problema**: Stripe garantiza entrega *at-least-once* de webhooks — el mismo evento
`checkout.session.completed` puede llegar 2+ veces (reintento por timeout, red, etc.). Sin
idempotencia, esto crearía `Order`s duplicados para un mismo pago (cobro único, dos pedidos).

**Decision**: `Payment.providerSessionId` (el id de la Checkout Session de Stripe) tiene
**constraint único** en Postgres (ver `data-model.md`). El handler del webhook, antes de crear
nada, intenta el `INSERT` de `Payment` con ese `providerSessionId` dentro de la misma
transacción que crea el `Order`. Si el `INSERT` viola el constraint único (ya existe un
`Payment` con ese `providerSessionId`) → se captura el error, no se crea nada nuevo, y se
responde `200 OK` a Stripe igual (evita que Stripe siga reintentando un evento ya procesado).
La unicidad la garantiza la base de datos, no un chequeo previo *check-then-insert* (que
tendría la misma race condition descrita arriba si dos entregas del webhook llegan casi
simultáneas).

**Rationale**: Un constraint único a nivel de DB es la única forma de garantizar "como mucho un
`Order` por sesión de pago" bajo entregas concurrentes del webhook — un `SELECT` previo
("¿ya existe?") seguido de un `INSERT` tiene la misma ventana de *check-then-act* que el
problema de stock; el constraint hace que la propia base de datos rechace el duplicado sin
importar el timing.

**Alternatives considered**: Deduplicar por el `id` del evento de Stripe (`evt_...`) en una
tabla aparte de eventos procesados — cubre además reintentos de *otros* tipos de evento, pero
para el alcance de este spec (solo importa `checkout.session.completed`) el constraint único
sobre `Payment.providerSessionId` ya es suficiente y no agrega una tabla nueva (Principio V).

## 5. Autorización por rol (RBAC) en NestJS

**Decision**: Un `@Roles(...roles: Role[])` decorator + `RolesGuard` global (lee el rol del
JWT ya validado por `JwtAuthGuard`) aplicado a nivel de controlador/endpoint. Para `DELIVERY`,
un guard adicional a nivel de servicio verifica que el `Order` consultado/mutado tenga
`assignedDeliveryUserId === request.user.id` (autorización a nivel de recurso, no solo de rol)
— cumple FR-018/FR-022.

**Rationale**: Patrón estándar de NestJS (guards + decorators), cumple Principio IV
("autorización aplicada en cada acción, no solo en la interfaz") sin librería adicional.

**Alternatives considered**: CASL (librería de autorización basada en reglas) — más expresivo
para políticas complejas, pero sobre-ingeniería para 4 roles con reglas simples (Principio V).

## 6. ACID — operaciones que DEBEN ser una sola transacción de Postgres

**Decision**: cuatro operaciones multi-escritura del sistema son transaccionalmente atómicas
(todo o nada, aislamiento vía locks de fila donde aplica). Ninguna se implementa como pasos
sueltos con manejo de fallos "a mano":

| Operación | Escrituras incluidas | Atomicidad / Aislamiento |
|---|---|---|
| Crear `StockHold` en checkout | `SELECT ... FOR UPDATE` sobre `ProductVariant` + `INSERT StockHold` | Row lock durante la transacción (§3) — resuelve la race condition de stock |
| Confirmar pago (webhook) | `INSERT Payment` (constraint único, idempotente) + `INSERT Order` (dispara trigger `trg_order_redeem_coupon` si hay `couponCode`) + `INSERT OrderItem` por ítem (dispara trigger `trg_order_item_settle_inventory`: decrementa `stockQuantity` con `UPDATE` condicional + borra `StockHold`) — el service ya no hace el decremento/borrado/redención a mano, los triggers los ejecutan dentro de la misma transacción (`data-model.md` §Triggers, revisado) | Si cualquier `INSERT` o trigger falla (constraint único de `Payment`, stock insuficiente), `ROLLBACK` completo — nunca queda un `Order` sin `Payment`, stock decrementado sin `Order`, o un cupón redimido sin `Order` |
| Rotación de refresh token | `UPDATE RefreshToken SET revokedAt` (el usado) + `INSERT RefreshToken` (el nuevo) | Atómico — nunca debe quedar un estado donde el viejo esté revocado pero el nuevo no se emitió (dejaría al usuario sin sesión válida) |
| Detección de reuso de refresh token | `UPDATE RefreshToken SET revokedAt = now() WHERE userId = :id AND revokedAt IS NULL` (todas las sesiones del usuario) | Atómico — revocación total o ninguna, para que un atacante no conserve una sesión válida en la ventana entre revocar unas y otras |

**Rationale**: son justo los puntos donde el spec exige garantías fuertes (SC-004 "0% sobreventa",
Principio IV "integridad de datos", FR-011 "pedido refleja exactamente lo pagado") — dejarlas
como escrituras separadas sin transacción abriría ventanas de inconsistencia bajo fallos
parciales (ej. el proceso muere entre decrementar stock y crear el `Order`).

**Nivel de aislamiento**: `READ COMMITTED` (default de Postgres/TypeORM) es suficiente en los
cuatro casos porque la sección crítica ya está serializada por un `SELECT ... FOR UPDATE`
explícito (creación de `StockHold`, §3) o por un `UPDATE ... WHERE <condición>` condicional que
toma su propio row lock implícito (decremento de stock y redención de cupón en los triggers,
`data-model.md` §Triggers) — no hace falta subir a `SERIALIZABLE` (Principio V, complejidad no
justificada).

## 7. SOLID (nivel de implementación)

No es una decisión de arquitectura de este research — la skill `nestjs-pro` ya instalada
(`references/code-quality.md`) define cómo aplican los 5 principios SOLID a servicios/
providers/DI de NestJS específicamente (Single Responsibility y Dependency Inversion son los
que más aparecen en la capa de servicios). `/speckit-tasks`/`/speckit-implement` deben seguir
esa guía al escribir `*.service.ts`, no se duplica aquí.

## 8. Estrategia de tests (unitarios + e2e, ambas capas)

**Decision**:

| Capa | Unitarios | E2E / Integración |
|---|---|---|
| Backend | Jest — un `*.spec.ts` por service/guard/controller (lógica que SÍ vive en NestJS: previsualización de cupón/promoción, máquina de estados de `Order`, rotación/reuso de refresh token, `RolesGuard`) | Supertest (`test:e2e` ya existe, contra la DB de test real) contra endpoints reales de `contracts/api.md`: login/refresh/reuse-detection, checkout con stock insuficiente, checkout con pago fallido, checkout con cupón agotado/expirado, checkout delivery sin dirección (rechazado), RBAC 403 por rol y por recurso (pedido no asignado) |
| Frontend | Vitest + RTL — componentes de carrito, formularios de checkout/login, guards de ruta por rol | Playwright — los 5 escenarios de `quickstart.md` de punta a punta (multi-rol: USER compra, ADMIN asigna delivery, DELIVERY actualiza estado) |

Por Principio III (NON-NEGOTIABLE), auth/carrito/checkout/pagos/fulfillment llevan test
**antes** que la implementación, en ambas capas — no solo backend. Catálogo/wishlist pueden
seguir tests-after. `/speckit-tasks` debe generar tareas de test explícitas (unit + e2e) para
cada módulo crítico, no solo tareas de implementación.

**Rationale**: cumplir el principio de la constitución literalmente (auth y checkout son
justamente los módulos con la lógica de rotación de tokens y dinero real) requiere que el
gate de "test escrito y en rojo antes de implementar" exista en frontend y backend por igual;
dejarlo implícito arriesga que solo se cumpla en backend (donde ya hay tooling) y se salte en
frontend (donde el tooling se agrega recién en este research).

**Alternatives considered**: cobertura solo backend (frontend "tests después"): más rápido al
inicio pero contradice Principio III para flujos que sí tienen lógica crítica en el cliente
(ej. validar que el checkout bloquea con carrito vacío, que el guard de ruta de `/admin`
redirige a un `USER`).

**Nota sobre triggers de Postgres** (`data-model.md` §Triggers): el decremento de stock y la
redención de cupón ahora viven en triggers de base de datos, no en services — un test unitario
de Jest con repositorio mockeado **no los ejecuta** (no hay Postgres real detrás del mock). La
única forma de probarlos es e2e contra la DB de test real: `test:e2e` DEBE incluir casos que
fuercen los invariantes de los triggers directamente (dos requests concurrentes por la última
unidad de stock, dos requests concurrentes por el último uso de un cupón) y verifiquen que
exactamente uno gana — no alcanza con probar el endpoint HTTP en el camino feliz.

## 9. Expiración de sesiones y "stock flotante" (inventory hoarding)

**Expiración de sesiones**: ya cubierta en §2 — access token 15 min, refresh token 7 días con
rotación + detección de reuso. Sin cambios aquí.

**Stock flotante / inventory hoarding**: el riesgo es que un usuario (o script) cree holds de
checkout repetidamente sobre un producto de alta demanda sin nunca pagar, para mantenerlo
artificialmente no disponible para otros compradores — renovando el hold justo antes de que
expire, indefinidamente.

**Decision**: dos mitigaciones, ninguna requiere Redis:

1. **`POST /checkout` ya requiere autenticación** (`contracts/api.md`, rol `USER` — consistente
   con FR-021). Esto por sí solo acota el abuso a identidades reales (no anónimas ilimitadas) y
   habilita rate limiting por `userId` en vez de por IP/anónimo.
2. **Rate limit en `/checkout`** con `@nestjs/throttler` en memoria (un solo proceso en Render,
   sin necesidad de storage distribuido — Principio V): límite razonable, ej. 5 intentos de
   checkout por variante cada 10 minutos por usuario. Además, un usuario que reintenta checkout
   sobre el **mismo carrito** reutiliza/reemplaza su `StockHold` anterior en vez de apilar uno
   nuevo (un `cartId` solo puede tener holds activos por su propio contenido, no N holds
   paralelos) — así que un solo usuario nunca puede acaparar más que la cantidad de su propio
   carrito, y el rate limit acota cuántas veces por ventana de tiempo puede renovar ese hold.

**Rationale**: como el checkout ya exige cuenta (FR-021, decisión ya tomada en `/speckit-clarify`),
la mitigación de hoarding no necesita infraestructura nueva — solo un throttler en memoria
(ya recomendado por la skill `nestjs-pro` para endpoints sensibles) con la key correcta
(`userId`, no IP) y la regla de "reemplazar, no apilar" holds del mismo carrito.

**Alternatives considered**: rate limiting distribuido vía Redis — solo se justificaría con
múltiples instancias del backend corriendo en paralelo; el plan actual es una sola instancia en
Render (Escala de portafolio, `plan.md` §Scale/Scope) — descartado por Principio V hasta que
haya una necesidad real de escalar horizontalmente.

## 11. Selección de dirección de entrega en mapa (FR-025/026)

**Decision**: Leaflet + tiles de OpenStreetMap para el mapa interactivo (pin arrastrable);
Nominatim (API pública de OSM) para búsqueda de dirección por texto (geocoding) y para
geocoding inverso (mostrar dirección legible a partir del pin). Frontend agrega `leaflet` +
`react-leaflet`. Sin API key, sin cuenta de billing.

**Rationale**: decisión confirmada con el usuario (cero fricción de cuenta/tarjeta, cero costo
— alineado con Principio V para un proyecto de portafolio). El flujo (FR-025) exige *búsqueda
por texto y/o marcador ubicable* — Nominatim cubre la búsqueda, Leaflet el pin arrastrable y el
reverse-geocoding para mostrar la dirección resultante.

**Límite operativo a documentar para implementación**: la instancia pública de Nominatim
(`nominatim.openstreetmap.org`) tiene política de uso justo — máx. ~1 request/seg y requiere
un `User-Agent` identificable; suficiente para el volumen de un portafolio, pero **no** apto
para producción de alto tráfico sin self-host o un proveedor de geocoding pago. Si el proyecto
alguna vez necesita más volumen, es una migración de proveedor (Mapbox/Google), no un cambio de
arquitectura — la selección del mapa es una capa aislada en el frontend.

**Alternatives considered**:
- Google Maps Platform: mejor UX/búsqueda y más familiar para usuarios, pero requiere cuenta
  Google Cloud con billing habilitado (tarjeta registrada) incluso dentro del free tier —
  fricción de setup rechazada explícitamente por el usuario para este proyecto.
- Mapbox GL JS: punto medio (buena UX, free tier sin tarjeta obligatoria al inicio), pero
  igual requiere cuenta + API key — descartado en favor de la opción sin ninguna cuenta.

## 12. Idempotencia y race condition en redención de cupones (FR-030/031) — **REVISADO: trigger**

**Decision**: la validación de un cupón en `/checkout` sigue siendo solo una
**previsualización** (lectura, no reserva) — incluye el chequeo de `minOrderAmountCents`
contra el carrito actual, que no depende de concurrencia entre usuarios y por eso se queda en
el service (no hay fila compartida que lockear para ese chequeo). La redención real —
`usedCount`/`maxTotalUses` y `maxUsesPerUser`, que sí son contadores compartidos entre
requests concurrentes — se resuelve en el momento del `INSERT Order` mediante el trigger
`trg_order_redeem_coupon` (`data-model.md` §Triggers):

1. El service arma el `INSERT Order` con `couponCode` si la previsualización lo aprobó.
2. El trigger, disparado por ese `INSERT`, hace un **`UPDATE` condicional atómico** sobre
   `Coupon` (`WHERE active AND vigente AND usedCount < maxTotalUses AND <conteo por usuario> <
   maxUsesPerUser`) — el propio `UPDATE` toma el row lock, no hace falta un `SELECT ... FOR
   UPDATE` previo del service.
3. Si el `UPDATE` afecta una fila: se inserta el `CouponRedemption` (constraint único
   `(couponId, orderId)` — idempotente ante reintentos del webhook, igual que
   `Payment.providerSessionId`).
4. Si el cupón se agotó justo en ese instante (el `UPDATE` no afecta ninguna fila): no se
   crea `CouponRedemption`, pero el pago **igual se completa** — el service ya decidió el
   `Order.discountCents` antes del `INSERT` en base a la previsualización; no se revierte el
   pago por esto (ya está autorizado en Stripe). Un cupón que se agota en esa ventana de
   milisegundos es un caso extremo aceptable — la alternativa (bloquear/reembolsar el pago) es
   peor experiencia para un caso de borde raro.

**Rationale**: evita la misma race condition de *check-then-act* que motivó rediseñar el stock
en §3 — sin el lock explícito (ahora vía `UPDATE` condicional en el trigger, no vía `SELECT
... FOR UPDATE` del service), dos usuarios podrían pasar la validación de "cupón disponible"
al mismo tiempo y ambos consumir el último uso. Mover esto al trigger además reduce el service
de pago a solo `INSERT`s (research.md §6) — el invariante de "nunca exceder el límite" queda
garantizado a nivel de base de datos sin importar qué código dispare el `INSERT Order`.

**Alternatives considered**:
- Reservar el cupón (como el `StockHold`) al momento de aplicarlo en el carrito, antes de
  pagar — más simétrico con el stock, pero un cupón "reservado y no usado" por 15 min bloquea
  su único uso a alguien que sí iba a pagar; dado que el cupón no es un recurso físico escaso
  (a diferencia del stock), es preferible revalidar solo al confirmar en vez de reservar por
  adelantado (menos complejidad, Principio V).
- `SELECT ... FOR UPDATE` explícito en el service (versión previa de esta sección) en vez del
  `UPDATE` condicional en el trigger: funcionalmente equivalente, pero exige que **cada**
  camino de código que redima un cupón recuerde hacer el lock correctamente; el `UPDATE`
  condicional en un trigger lo garantiza sin depender de que el service lo implemente bien —
  se prefirió por ser el mismo principio que `chk_stock_non_negative`: la base de datos hace
  cumplir el invariante, no la disciplina del desarrollador.

## 13. Promociones automáticas — cálculo de precio efectivo (FR-032..035)

**Decision**: el precio con descuento de `Promotion` se calcula **al leer** (catálogo, detalle
de producto, carrito), nunca se persiste en `ProductVariant`. La consulta de catálogo hace un
`LEFT JOIN` contra `Promotion` filtrando `active = true AND validFrom <= now() AND validUntil
>= now()` y matcheando por `productId`, `brand`, o `categoryId` (research.md `data-model.md`
§Promotion); en el servicio, se resuelve en memoria cuál promoción gana por precedencia
(`PRODUCT > BRAND > CATEGORY`, desempate por mayor descuento, FR-034) y se expone
`price` (base) + `effectivePrice` (con descuento) por variante en la respuesta de
`GET /products`.

**Rationale**: evita el problema de *stale price* de guardar el precio con descuento en la
fila del producto (requeriría un job para "activar"/"desactivar" promociones exactamente en su
`validFrom`/`validUntil`) — calculando en la lectura, una promoción que expira deja de aplicar
en la siguiente request, sin ningún job ni cron (Principio V, mismo argumento que el
auto-vencimiento de `StockHold` en §3).

**Rationale de la congelación en `OrderItem`**: igual que el precio base (FR-011), el
`effectivePrice` calculado en el momento del checkout es el que se congela en
`OrderItem.unitPriceCents` al confirmar el pago — si la promoción expira entre que el usuario
ve el catálogo y paga, se re-calcula en el checkout (mismo patrón de revalidación que stock
FR-020 y cupón FR-030), no se garantiza el precio visto minutos antes.

**Alternatives considered**: cachear el precio efectivo en Redis con invalidación al
crear/editar una promoción — reintroduce una segunda fuente de verdad para algo que ya se
descartó explícitamente para catálogo en la validación de alcance de Redis; el cálculo en
lectura sobre Postgres es suficientemente barato a escala de portafolio (Principio V).

## 14. Audit log de acciones privilegiadas (FR-036)

**Decision**: interceptor de NestJS (`AuditInterceptor`), no trigger de Postgres — ver
justificación completa en `data-model.md` §AuditLog. Se aplica con un decorator
(`@Audited('Order')`, `@Audited('Product')`, etc.) sobre los endpoints mutantes de
`ADMIN`/`INVENTORY_MANAGER` ya listados en `contracts/api.md` (asignar/transicionar `Order`,
CRUD de `Product`/`ProductVariant`/`Category`/`Coupon`/`Promotion`/`PickupLocation`). El
interceptor corre **después** de que el handler del controller confirma éxito (evita loguear
intentos fallidos/rechazados por validación), toma `req.user.id` como `actorUserId` y calcula
el `metadata` (diff `from`/`to`) comparando el estado antes/después que el service ya tenía
que leer de todos modos para el `UPDATE`.

**Rationale**: un solo mecanismo transversal en vez de instrumentar cada service a mano (que
tiene el mismo riesgo de "se me olvidó" que se evitó con triggers en stock/cupón, pero acá la
solución correcta es un interceptor compartido, no un trigger por tabla — más simple porque ya
existe un único punto de entrada, la API REST). Se decidió explícitamente **no** replicar el
patrón de trigger usado para stock/cupón (research.md §§3, 12): ahí el trigger existía porque
el invariante debía sobrevivir sin importar el código; acá no hay invariante que proteger de un
código bypasseando la DB, solo un registro a escribir — un interceptor es la herramienta más
simple que resuelve exactamente eso (Principio V).

**Alcance explícitamente chico**: no audita lecturas, no audita acciones de `USER` sobre sus
propios datos, no es un audit log genérico "toda tabla" — solo las acciones de privilegio
elevado que un panel de admin necesitaría mostrar como historial. Si el alcance crece (ej.
cumplimiento normativo real), esto se revisita como amendment a la constitución, no se
sobre-construye ahora sin ese requisito concreto.

**Alternatives considered**:
- Trigger de Postgres por tabla (mismo patrón que stock/cupón): requeriría pasar
  `actorUserId` vía `SET LOCAL` en cada transacción y un trigger por cada una de las 7 tablas
  cubiertas — más piezas móviles que un interceptor, sin beneficio (no hay segundo camino de
  escritura que proteger, a diferencia de stock/cupón). Descartado.
- Librería de audit logging (ej. `typeorm-audit`, event sourcing completo): resuelve un
  problema más general del que se tiene — sobre-ingeniería para 7 tipos de acción con un
  formato de registro simple (Principio V).

## 15. Excepciones de dominio y traducción de errores de Postgres

**Problema**: varios errores "esperados" del sistema hoy solo existen como excepciones crudas
de Postgres — el `RAISE EXCEPTION` de `trg_order_item_settle_inventory` (data-model.md
§Triggers), los `CHECK` (`chk_fulfillment_consistency`, `chk_stock_non_negative`,
`chk_coupon_usage`) y los `UNIQUE` (`Payment.providerSessionId`, `User.email`, `Coupon.code`,
etc.). Sin traducción, esos errores llegan a TypeORM como `QueryFailedError` con el mensaje
técnico de Postgres (nombres de columna en inglés/snake_case, UUIDs, a veces hasta fragmento de
SQL) — inaceptable para una respuesta HTTP que un usuario final va a leer.

**Decision**: una jerarquía chica de excepciones de dominio (`BusinessException` +
subclases) más un mapeo explícito en el `GlobalExceptionFilter` (ya planeado, Foundational)
que traduce cualquier `QueryFailedError` a una de ellas antes de responder — nunca se expone
`error.message`/`error.stack` crudo de Postgres al cliente.

```typescript
// backend/src/common/exceptions/business.exception.ts
export class BusinessException extends HttpException {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super({ statusCode: status, code, message, details }, status);
  }
}

// backend/src/common/exceptions/domain-exceptions.ts
export class InsufficientStockException extends BusinessException {
  constructor() {
    super(409, 'INSUFFICIENT_STOCK', 'No hay suficiente stock disponible para completar esta operación.');
  }
}
export class InvalidFulfillmentException extends BusinessException {
  constructor() {
    super(400, 'INVALID_FULFILLMENT', 'Elegí recojo en sucursal o delivery con una dirección válida — no ambos, no ninguno.');
  }
}
export class CouponInvalidException extends BusinessException {
  constructor(reason: 'EXPIRED' | 'INACTIVE' | 'LIMIT_REACHED' | 'MIN_AMOUNT_NOT_MET') {
    const messages = {
      EXPIRED: 'Este cupón ya venció.',
      INACTIVE: 'Este cupón ya no está activo.',
      LIMIT_REACHED: 'Este cupón alcanzó su límite de usos.',
      MIN_AMOUNT_NOT_MET: 'Tu carrito no alcanza el monto mínimo para este cupón.',
    };
    super(400, `COUPON_${reason}`, messages[reason]);
  }
}
export class CartEmptyException extends BusinessException {
  constructor() {
    super(400, 'CART_EMPTY', 'Tu carrito está vacío.');
  }
}
export class OrderAccessDeniedException extends BusinessException {
  constructor() {
    super(403, 'ORDER_ACCESS_DENIED', 'No tenés permiso para ver o modificar este pedido.');
  }
}
export class DeliveryAddressRequiredException extends BusinessException {
  constructor() {
    super(400, 'DELIVERY_ADDRESS_REQUIRED', 'Elegí una dirección de entrega en el mapa antes de continuar.');
  }
}
export class DuplicateResourceException extends BusinessException {
  constructor(resource: string) {
    super(409, 'DUPLICATE_RESOURCE', `Ya existe un/a ${resource} con esos datos.`);
  }
}
export class RefreshTokenReuseException extends BusinessException {
  constructor() {
    super(401, 'SESSION_REVOKED', 'Tu sesión se cerró por seguridad. Iniciá sesión de nuevo.');
  }
}
export class PaymentFailedException extends BusinessException {
  constructor() {
    super(402, 'PAYMENT_FAILED', 'El pago no pudo procesarse. Tu carrito sigue intacto, podés reintentar.');
  }
}
```

**Traducción de errores de Postgres** (dentro de `GlobalExceptionFilter`): en vez de matchear
el texto del mensaje (frágil — cambia si se reescribe el `RAISE EXCEPTION`), se usa el
`SQLSTATE`/nombre de constraint, que Postgres siempre reporta de forma estructurada
(`error.code`, `error.constraint` en el driver `pg`):

| Origen | SQLSTATE / constraint | Excepción traducida |
|---|---|---|
| `trg_order_item_settle_inventory` (RAISE EXCEPTION con `ERRCODE = 'TS001'`, código custom — data-model.md §Triggers) | `TS001` | `InsufficientStockException` |
| `chk_stock_non_negative` | `23514` + `constraint = 'chk_stock_non_negative'` | `InsufficientStockException` |
| `chk_fulfillment_consistency` | `23514` + `constraint = 'chk_fulfillment_consistency'` | `InvalidFulfillmentException` |
| `chk_coupon_usage` | `23514` + `constraint = 'chk_coupon_usage'` | 409 genérico (no debería dispararse nunca — el trigger ya lo previene; si pasa, es señal de bug, se loguea con `Logger.error` para investigar) |
| `Payment.providerSessionId`, `User.email`, `Coupon.code`, etc. | `23505` (unique_violation) + `constraint` | `DuplicateResourceException(<recurso según constraint>)` |
| Cualquier otro error no reconocido | — | 500 genérico ("Ocurrió un error inesperado, intentá de nuevo"), con el error real solo en logs del servidor (nunca en la respuesta — nestjs-pro §Pre-Deploy Checklist: "Stack traces not exposed in error responses") |

**Rationale**: el `SQLSTATE`/constraint es la única señal estable — el texto de un mensaje de
error puede cambiar (traducción, redacción) sin que eso deba romper el mapeo. Da un contrato
de errores consistente (`{ statusCode, code, message }`) para que el frontend muestre mensajes
en español sin tener que interpretar texto de Postgres, y cumple Principio IV (nunca exponer
detalles internos) sin perder la garantía de integridad que ya dan los triggers/constraints
(research.md §§3, 6, 12).

**Alternatives considered**:
- Matchear por texto del mensaje de error: fragil ante cualquier cambio de redacción del
  `RAISE EXCEPTION`; rechazado.
- Manejar cada caso "a mano" en cada service (try/catch por endpoint): nestjs-pro ya
  recomienda "no `try/catch` — dejar que las excepciones propaguen al filtro global"; un
  mapeo centralizado en el filtro es menos código repetido y más difícil de olvidar en un
  endpoint nuevo.

## 16. Nota de riesgo: versión de `typeorm` en `backend/package.json`

`backend/package.json` fija `"typeorm": "^1.1.0"`. Al día del último research conocido por este
agente, la línea de publicación activa de TypeORM es 0.3.x — no se pudo confirmar si `^1.1.0`
es una versión real ya publicada al momento de implementar. **Acción para Phase de
implementación**: correr `npm install` y confirmar con `npm view typeorm versions` (o
equivalente) que la versión resuelta es la esperada antes de escribir migraciones/entidades;
si `^1.1.0` no resuelve a un paquete válido, corregir a la última 0.3.x compatible con
`@nestjs/typeorm ^11`.
