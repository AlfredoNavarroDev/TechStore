# Feature Specification: Core Store & RBAC (Catálogo, Carrito, Checkout, Pedidos, Admin)

**Feature Branch**: `001-core-store-mvp`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "Tienda virtual (TechStore) dedicada a la venta de periféricos, componentes y todo lo relacionado a computadoras y laptops, con recojo en local o delivery (tarifa fija). RBAC con 4 roles (USER, ADMIN, INVENTORY_MANAGER, DELIVERY). Funcionalidades: catálogo con filtrado y búsqueda, carrito de compras, checkout con pasarela de pagos, gestión de pedidos (historial y estado), panel de administración de inventario, autenticación y autorización JWT."

## Clarifications

### Session 2026-08-07

- Q: ¿Un cliente puede completar el pago sin crear cuenta (checkout como invitado), o siempre se requiere estar logueado para pagar? → A: Checkout requiere cuenta autenticada; el carrito sí permite invitado antes de pagar.
- Q: ¿Quién asigna un pedido delivery a un repartidor específico? → A: ADMIN asigna manualmente cada pedido delivery a un repartidor.
- Q: ¿En qué moneda se muestran y cobran los precios de la tienda? → A: Sol peruano (PEN), moneda única.
- Q: ¿Por cuánto tiempo se reserva el stock de un carrito mientras el pago está en proceso? → A: 15 minutos, luego se libera automáticamente si el pago no se completa.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explorar catálogo y buscar productos (Priority: P1)

Un visitante (sin necesidad de cuenta) navega el catálogo de periféricos, componentes,
laptops y PCs, filtra por categoría y busca productos por nombre para encontrar lo que
necesita antes de decidir comprar.

**Why this priority**: Es el punto de entrada de todo el negocio — sin descubrimiento de
producto no hay carrito ni checkout. Debe funcionar de forma independiente y sin fricción
(no requiere login).

**Independent Test**: Puede probarse por completo visitando el catálogo, aplicando un
filtro de categoría y una búsqueda por texto, y verificando que los resultados mostrados
coinciden con el filtro/búsqueda aplicados — sin necesidad de cuenta, carrito ni pago.

**Acceptance Scenarios**:

1. **Given** el catálogo tiene productos en varias categorías, **When** el visitante
   selecciona una categoría, **Then** solo se muestran productos de esa categoría.
2. **Given** el visitante escribe un término de búsqueda, **When** ejecuta la búsqueda,
   **Then** se muestran solo productos cuyo nombre o descripción coincide con el término.
3. **Given** un producto tiene variantes (ej. color, capacidad), **When** el visitante abre
   el detalle del producto, **Then** puede ver y seleccionar entre las variantes disponibles
   con su stock respectivo.
4. **Given** una combinación de filtro + búsqueda no tiene resultados, **When** se aplica,
   **Then** el sistema muestra un estado vacío claro en vez de un error o pantalla en blanco.

---

### User Story 2 - Carrito y checkout con pago (Priority: P1)

Un usuario agrega productos al carrito, ajusta cantidades, elige entre recojo en local o
delivery (tarifa fija), y completa el pago para generar un pedido.

**Why this priority**: Es la conversión — el momento donde el negocio genera ingreso. Sin
esto, el catálogo es solo un escaparate.

**Independent Test**: Puede probarse agregando productos al carrito, modificando cantidades,
seleccionando modalidad de entrega, y completando el pago; se verifica que el pedido resultante
refleja exactamente los ítems, cantidades y modalidad elegidos.

**Acceptance Scenarios**:

1. **Given** un producto disponible en el catálogo, **When** el usuario lo agrega al carrito,
   **Then** el carrito refleja el producto y la cantidad indicada.
2. **Given** un ítem en el carrito, **When** el usuario actualiza la cantidad o lo quita,
   **Then** el carrito y su total se actualizan de inmediato.
3. **Given** un carrito con ítems, **When** el usuario intenta agregar más unidades de las
   disponibles en stock, **Then** el sistema lo impide y muestra el stock disponible.
4. **Given** un carrito con ítems, **When** el usuario procede al checkout, **Then** puede
   elegir entre recojo en sucursal (sin costo) o delivery (con la tarifa fija visible antes
   de pagar).
5. **Given** el usuario elige delivery, **When** llega al paso de dirección, **Then** DEBE
   seleccionar la ubicación de entrega en un mapa interactivo (buscando por texto o marcando
   el punto directamente) antes de poder continuar al pago.
6. **Given** una ubicación seleccionada en el mapa, **When** el usuario la confirma, **Then**
   el pedido guarda la dirección en texto y las coordenadas geográficas correspondientes.
7. **Given** un checkout con modalidad y pago elegidos, **When** el pago se confirma
   exitosamente, **Then** se crea un pedido con estado inicial, se descuenta el stock
   reservado y el carrito queda vacío.
8. **Given** un pago que falla o es rechazado, **When** ocurre el error, **Then** el carrito
   se conserva intacto y el usuario ve un mensaje claro para reintentar.

---

### User Story 3 - Autenticación, cuenta y seguimiento de pedidos (Priority: P2)

Un usuario se registra/inicia sesión y consulta el historial y estado de sus propios
pedidos.

**Why this priority**: Necesario para checkout persistente, atribución de pedidos y RBAC,
pero el catálogo y la mecánica de carrito (US1/US2) pueden construirse y probarse antes con
un carrito de invitado.

**Independent Test**: Puede probarse registrando una cuenta, iniciando sesión, y verificando
que el historial de pedidos muestra únicamente los pedidos asociados a esa cuenta con su
estado actual.

**Acceptance Scenarios**:

1. **Given** un visitante sin cuenta, **When** se registra con datos válidos, **Then** se
   crea su cuenta con rol `USER` por defecto.
2. **Given** un usuario registrado, **When** inicia sesión con credenciales válidas,
   **Then** obtiene acceso autenticado a su cuenta y su carrito de invitado (si existía) se
   fusiona con su cuenta.
3. **Given** un usuario autenticado con pedidos previos, **When** visita su historial,
   **Then** ve todos sus pedidos ordenados por fecha con su estado actual
   (ej. pendiente, pagado, en preparación, en camino/listo para recojo, entregado, cancelado).
4. **Given** un usuario autenticado, **When** intenta acceder a un pedido de otro usuario o a
   una acción de otro rol, **Then** el sistema deniega el acceso.

---

### User Story 4 - Gestión de inventario (Priority: P2)

Un `ADMIN` o `INVENTORY_MANAGER` gestiona el catálogo: crea/edita productos, variantes,
categorías y niveles de stock desde un panel de administración.

**Why this priority**: Sin esto no hay forma de mantener el catálogo actualizado más allá de
la carga inicial, pero el resto de la tienda puede operar con datos sembrados mientras esto
se construye.

**Independent Test**: Puede probarse iniciando sesión como `ADMIN` o `INVENTORY_MANAGER`,
creando/editando un producto o ajustando su stock, y verificando que el cambio se refleja de
inmediato en el catálogo público.

**Acceptance Scenarios**:

1. **Given** un usuario con rol `ADMIN` o `INVENTORY_MANAGER`, **When** crea un nuevo
   producto con al menos una variante y categoría, **Then** el producto aparece en el
   catálogo público.
2. **Given** un producto existente, **When** el `ADMIN`/`INVENTORY_MANAGER` actualiza su
   stock, **Then** el stock disponible para compra se actualiza de inmediato.
3. **Given** un usuario con rol `USER` o `DELIVERY`, **When** intenta acceder al panel de
   inventario, **Then** el sistema deniega el acceso.
4. **Given** un producto sin stock, **When** un usuario intenta agregarlo al carrito,
   **Then** el sistema lo muestra como agotado y no permite agregarlo.

---

### User Story 5 - Gestión de entregas y estado de pedidos (Priority: P3)

Un `ADMIN` asigna manualmente cada pedido con modalidad delivery a un repartidor
(`DELIVERY`); ese `DELIVERY` visualiza los pedidos que tiene asignados y actualiza su estado
(en camino, entregado). El `ADMIN` visualiza y gestiona el estado de todos los pedidos,
incluyendo los de recojo en local.

**Why this priority**: Cierra el ciclo del pedido después del pago, pero depende de que ya
existan pedidos generados (US2) y roles definidos (US3), por eso va después.

**Independent Test**: Puede probarse creando un pedido de prueba con modalidad delivery,
asignándolo, iniciando sesión como `DELIVERY`, y verificando que solo ese pedido es visible
y que su cambio de estado se refleja en el historial del cliente.

**Acceptance Scenarios**:

1. **Given** un pedido pagado con modalidad delivery, **When** el `ADMIN` lo asigna
   manualmente a un repartidor, **Then** ese pedido aparece en la lista de pedidos asignados
   de ese `DELIVERY` y de ningún otro.
2. **Given** un pedido asignado, **When** el `DELIVERY` marca "en camino" o "entregado",
   **Then** el estado se refleja de inmediato en el historial del cliente.
3. **Given** un pedido con modalidad recojo en local, **When** se consulta como `DELIVERY`,
   **Then** no aparece en su lista (fuera de su alcance).
4. **Given** un `DELIVERY` autenticado, **When** intenta acceder a inventario, usuarios o
   pedidos no asignados a él, **Then** el sistema deniega el acceso.

---

### User Story 6 - Cupones de descuento (Priority: P3)

Un usuario aplica un código de cupón en el checkout para obtener un descuento antes de pagar;
un `ADMIN` crea y gestiona los cupones disponibles (código, tipo de descuento, vigencia,
límite de usos).

**Why this priority**: Aumenta conversión/valor percibido, pero el checkout ya funciona
completo sin cupones (US2) — es un complemento, no un bloqueante del MVP.

**Independent Test**: Puede probarse creando un cupón como `ADMIN`, aplicándolo en el checkout
como `USER`, y verificando que el total pagado refleja el descuento correctamente; y que un
cupón inválido/expirado/agotado es rechazado con un mensaje claro.

**Acceptance Scenarios**:

1. **Given** un cupón activo y vigente, **When** el usuario lo aplica en el checkout,
   **Then** el total se recalcula con el descuento antes de pagar.
2. **Given** un cupón expirado o desactivado, **When** el usuario intenta aplicarlo,
   **Then** el sistema lo rechaza con un mensaje claro del motivo.
3. **Given** un cupón que ya alcanzó su límite total de usos (o el límite por usuario),
   **When** el usuario intenta aplicarlo, **Then** el sistema lo rechaza.
4. **Given** un cupón con monto mínimo de compra, **When** el carrito no alcanza ese mínimo,
   **Then** el sistema lo rechaza indicando el mínimo requerido.
5. **Given** un `ADMIN`, **When** crea un cupón con código único, tipo de descuento
   (porcentaje o monto fijo), vigencia y límite de usos, **Then** el cupón queda disponible
   para aplicarse.
6. **Given** un cupón con un solo uso disponible, **When** dos usuarios intentan aplicarlo y
   pagar casi simultáneamente, **Then** como mucho uno de los dos pedidos obtiene el
   descuento — el límite de usos nunca se excede.

---

### User Story 7 - Promociones automáticas por producto/marca/categoría (Priority: P3)

Un `ADMIN` crea promociones que se aplican automáticamente al precio mostrado en catálogo y
carrito, sin que el cliente ingrese ningún código — a diferencia de los cupones (US6). Una
promoción aplica sobre un producto específico, una marca, o una categoría completa.

**Why this priority**: Herramienta de marketing/liquidación de inventario — el checkout y el
catálogo ya funcionan completos sin esto (independiente de US1-US6).

**Independent Test**: Puede probarse creando una promoción sobre una categoría como `ADMIN`, y
verificando que el catálogo muestra el precio con descuento para todos los productos de esa
categoría sin que el usuario haga nada adicional.

**Acceptance Scenarios**:

1. **Given** un `ADMIN` crea una promoción de 15% sobre la categoría "Laptops", **When** un
   usuario navega el catálogo, **Then** todas las laptops muestran el precio con descuento
   aplicado automáticamente.
2. **Given** una promoción vigente por categoría y otra vigente sobre un producto específico
   de esa categoría, **When** un usuario ve ese producto, **Then** se aplica la promoción del
   producto (más específica), no la de categoría.
3. **Given** una promoción llega a su fecha de fin, **When** expira, **Then** el precio vuelve
   al normal automáticamente, sin acción manual del `ADMIN`.
4. **Given** un `ADMIN` crea una promoción sobre una marca, **When** un usuario ve cualquier
   producto de esa marca, **Then** ve el precio con el descuento aplicado.
5. **Given** un usuario compra un producto con promoción activa, **When** el pago se confirma,
   **Then** el pedido registra el precio ya con el descuento de la promoción (congelado, mismo
   principio que FR-011).

---

### Edge Cases

- ¿Qué pasa si dos usuarios intentan comprar la última unidad de un producto al mismo tiempo?
  El sistema debe garantizar que solo uno complete la compra sobre esa unidad; el segundo ve
  el producto como agotado antes de poder pagar.
- ¿Qué pasa si el pago se aprueba pero la confirmación tarda o se pierde la conexión? El
  pedido debe terminar en un estado consistente y verificable (no duplicado, no "perdido")
  cuando el usuario vuelve a consultar su historial.
- ¿Qué pasa si un `ADMIN`/`INVENTORY_MANAGER` reduce el stock de un producto que ya está en
  el carrito de otro usuario? El carrito debe re-validar disponibilidad al momento del
  checkout, no solo al agregar.
- ¿Qué pasa si se intenta pagar un carrito vacío o con ítems ya agotados? El checkout debe
  bloquearse con un mensaje claro.
- ¿Qué pasa si un usuario invitado (sin cuenta) agrega productos al carrito y luego cierra el
  navegador? El carrito de invitado debe persistir el tiempo suficiente para recuperarse en
  una sesión posterior o al iniciar sesión.
- ¿Qué pasa si un usuario reintenta el checkout del mismo producto repetidamente sin pagar
  nunca (acaparamiento de stock)? El sistema debe limitar cuántas veces puede reservar stock
  en una ventana de tiempo, y reemplazar (no acumular) su propia reserva anterior sobre el
  mismo carrito.
- ¿Qué pasa si la confirmación de un pago llega duplicada (reintento de la pasarela de pago)?
  El sistema debe procesar el pago una sola vez y no debe crear pedidos duplicados por el mismo
  pago.
- ¿Qué pasa si el usuario no puede o no quiere interactuar con el mapa (sin permitir
  geolocalización, dispositivo sin soporte)? Debe poder buscar la dirección por texto como
  alternativa a marcar el punto manualmente.
- ¿Qué pasa si el usuario quita ítems del carrito después de aplicar un cupón y el carrito ya
  no cumple el monto mínimo del cupón? El sistema debe revalidar el cupón en ese momento y
  quitarlo o avisar que dejó de calificar, antes de permitir pagar.
- ¿Qué pasa si dos promociones de la misma especificidad (ej. dos por categoría) aplican al
  mismo producto a la vez? El sistema debe usar la que dé mayor descuento al cliente.
- ¿Qué pasa si un producto tiene una promoción activa y además el usuario aplica un cupón?
  Ambos se combinan: la promoción ya está reflejada en el precio unitario del producto, el
  cupón se aplica sobre el total del pedido (que ya incluye el precio con promoción) — no hay
  conflicto entre ambos mecanismos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar un catálogo público de productos navegable sin
  necesidad de autenticación.
- **FR-002**: El sistema DEBE permitir filtrar el catálogo por categoría.
- **FR-003**: El sistema DEBE permitir buscar productos por texto (nombre/descripción).
- **FR-004**: El sistema DEBE mostrar, por producto, sus variantes disponibles y el stock de
  cada una.
- **FR-005**: El sistema DEBE permitir agregar, quitar y actualizar la cantidad de ítems en
  un carrito, tanto para usuarios invitados como autenticados.
- **FR-006**: El sistema DEBE impedir agregar al carrito o completar checkout una cantidad
  mayor al stock disponible de una variante.
- **FR-007**: El sistema DEBE fusionar el carrito de invitado con el carrito del usuario al
  iniciar sesión.
- **FR-008**: El sistema DEBE permitir elegir entre recojo en sucursal o delivery (con tarifa
  fija) antes de confirmar el pago.
- **FR-009**: El sistema DEBE procesar el pago mediante una pasarela de pagos externa y solo
  crear el pedido tras confirmación exitosa del pago.
- **FR-010**: El sistema DEBE mantener el carrito intacto si el pago falla o es rechazado.
- **FR-011**: El sistema DEBE registrar cada pedido con sus ítems, precios al momento de la
  compra, modalidad de entrega, y estado.
- **FR-012**: El sistema DEBE permitir a un usuario autenticado consultar el historial y
  estado de sus propios pedidos, y le DEBE impedir ver pedidos de otros usuarios.
- **FR-013**: El sistema DEBE permitir el registro y autenticación de usuarios, y asignar el
  rol `USER` por defecto a las cuentas nuevas.
- **FR-014**: El sistema DEBE soportar cuatro roles — `USER`, `ADMIN`, `INVENTORY_MANAGER`,
  `DELIVERY` — con permisos diferenciados según lo descrito en las historias de usuario.
- **FR-015**: El sistema DEBE permitir a `ADMIN` e `INVENTORY_MANAGER` crear, editar y
  gestionar el stock de productos, variantes y categorías.
- **FR-016**: El sistema DEBE impedir a los roles `USER` y `DELIVERY` el acceso a las
  funciones de gestión de inventario.
- **FR-017**: El sistema DEBE permitir a `ADMIN` ver y actualizar el estado de todos los
  pedidos, sin importar la modalidad de entrega.
- **FR-018**: El sistema DEBE permitir a `DELIVERY` ver y actualizar el estado únicamente de
  los pedidos con modalidad delivery que tiene asignados, y le DEBE impedir ver pedidos de
  recojo en local o de otros repartidores.
- **FR-019**: El sistema DEBE denegar cualquier acción de un rol fuera de los permisos
  definidos para ese rol (autorización aplicada en cada acción, no solo en la interfaz).
- **FR-020**: El sistema DEBE re-validar la disponibilidad de stock al momento del checkout,
  no solo al agregar al carrito.
- **FR-021**: El sistema DEBE requerir que el usuario esté autenticado para completar el pago
  del checkout; el carrito DEBE seguir siendo usable sin autenticación (modo invitado) hasta
  ese punto.
- **FR-022**: El sistema DEBE permitir únicamente a `ADMIN` asignar manualmente un pedido con
  modalidad delivery a un usuario con rol `DELIVERY`; un pedido sin asignar no debe ser
  visible para ningún `DELIVERY`.
- **FR-023**: El sistema DEBE mostrar y cobrar todos los precios (productos, tarifa de
  delivery, pedidos) en una única moneda: Sol peruano (PEN).
- **FR-024**: El sistema DEBE reservar el stock de los ítems del carrito por 15 minutos al
  iniciar el checkout, liberándolo automáticamente para otros compradores si el pago no se
  completa en ese plazo.
- **FR-025**: Cuando el usuario elige delivery, el sistema DEBE requerir que seleccione la
  dirección de entrega mediante un mapa interactivo (búsqueda por texto y/o marcador
  ubicable), antes de poder continuar al pago.
- **FR-026**: El sistema DEBE guardar en el pedido la dirección seleccionada en texto y sus
  coordenadas geográficas (latitud/longitud).
- **FR-027**: El sistema DEBE permitir a `ADMIN` crear, editar y desactivar cupones con:
  código único, tipo de descuento (porcentaje o monto fijo), vigencia (fecha inicio/fin),
  límite total de usos, límite de usos por usuario, y monto mínimo de compra (opcional).
- **FR-028**: El sistema DEBE permitir a un usuario aplicar un código de cupón válido en el
  checkout y ver el descuento reflejado en el total antes de pagar.
- **FR-029**: El sistema DEBE rechazar cupones expirados, desactivados, que excedan su límite
  de usos, o que no cumplan el monto mínimo, indicando el motivo específico del rechazo.
- **FR-030**: El sistema DEBE re-validar el cupón aplicado (vigencia, límite de usos, monto
  mínimo) al momento de confirmar el pago, no solo al aplicarlo — mismo principio que FR-020
  para el stock.
- **FR-031**: El sistema DEBE garantizar que el uso concurrente de un cupón nunca exceda su
  límite total de usos ni su límite por usuario.
- **FR-032**: El sistema DEBE permitir a `ADMIN` crear, editar y desactivar promociones
  automáticas con: nombre, tipo de descuento (porcentaje o monto fijo), alcance (un producto
  específico, una marca, o una categoría), y vigencia (fecha inicio/fin).
- **FR-033**: El sistema DEBE aplicar automáticamente el descuento de cualquier promoción
  vigente al precio mostrado en catálogo y carrito, sin que el usuario ingrese ningún código.
- **FR-034**: Cuando más de una promoción aplica al mismo producto, el sistema DEBE usar la
  más específica (producto > marca > categoría); ante un empate de especificidad, DEBE usar
  la que dé mayor descuento.
- **FR-035**: El precio de un pedido DEBE reflejar el descuento de cualquier promoción vigente
  al momento de la compra, congelado igual que el resto del precio (FR-011).
- **FR-036**: El sistema DEBE registrar quién hizo y cuándo cada acción privilegiada (cambio de
  estado o asignación de un pedido; creación/edición de productos, categorías, cupones,
  promociones o sucursales), y DEBE permitir a `ADMIN` consultar ese historial.

### Key Entities

- **User**: Cuenta con credenciales y un rol (`USER`, `ADMIN`, `INVENTORY_MANAGER`,
  `DELIVERY`); dueño de sus carritos, pedidos y wishlist.
- **Category**: Agrupación de productos (ej. laptops, componentes, periféricos).
- **Product / ProductVariant**: Producto vendible con una o más variantes (cada variante con
  su propio stock y atributos como color/capacidad).
- **PickupLocation**: Sucursal física donde un pedido puede recogerse.
- **Cart / CartItem**: Carrito (de invitado o de usuario) y sus ítems con cantidad.
- **Order / OrderItem**: Pedido confirmado, sus ítems con precio congelado al momento de la
  compra, modalidad de entrega (delivery/recojo), estado, y — solo para pedidos delivery —
  el repartidor (`DELIVERY`) asignado manualmente por `ADMIN`.
- **Payment**: Registro del intento/resultado de pago asociado a un pedido.
- **WishlistItem**: Producto guardado por un usuario para más adelante (fuera del flujo de
  compra inmediato).
- **Coupon**: Código de descuento gestionado por `ADMIN` — tipo (porcentaje o monto fijo),
  vigencia, límite total de usos, límite por usuario, monto mínimo de compra opcional.
- **Promotion**: Descuento automático (sin código) gestionado por `ADMIN` — tipo (porcentaje o
  monto fijo), alcance (producto, marca o categoría), vigencia. Se aplica solo al precio
  mostrado/pagado, no requiere acción del cliente.
- **DeliveryAddress** (parte de `Order`, no una entidad independiente): dirección en texto,
  latitud/longitud, seleccionadas en el mapa al momento del checkout — solo aplica a pedidos
  con modalidad delivery.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario nuevo puede encontrar un producto específico (vía filtro o
  búsqueda) en menos de 30 segundos.
- **SC-002**: Un usuario puede completar el flujo carrito → checkout → pago confirmado en
  menos de 3 minutos en el camino feliz.
- **SC-003**: El 100% de los pedidos creados reflejan exactamente los ítems, cantidades,
  precios y modalidad de entrega elegidos por el usuario al pagar.
- **SC-004**: 0% de pedidos se crean con stock insuficiente (ninguna sobreventa).
- **SC-005**: El 100% de los intentos de acceso a una acción fuera del rol del usuario son
  denegados.
- **SC-006**: Un repartidor (`DELIVERY`) puede ver y actualizar el estado de un pedido
  asignado en menos de 3 pasos desde que inicia sesión.
- **SC-007**: Un usuario puede consultar el estado actual de cualquier pedido propio en
  menos de 10 segundos desde que entra a su historial.
- **SC-008**: 0% de pedidos exceden el límite total de usos o el límite por usuario de un
  cupón (ningún cupón se sobre-redime por uso concurrente).
- **SC-009**: Un usuario puede seleccionar una dirección de entrega válida en el mapa (buscar
  o marcar) en menos de 1 minuto.
- **SC-010**: 100% de los productos con una promoción vigente muestran el precio con
  descuento en catálogo sin acción del usuario.

## Assumptions

- El pago se procesa mediante una pasarela de pagos externa de terceros ya definida a nivel
  de proyecto (Stripe, según README/constitución); esta especificación no detalla su
  integración técnica.
- La tarifa de delivery es fija y única (no varía por distancia, peso o ubicación) — según
  descripción del negocio.
- Los cupones son de alcance global sobre el total del pedido (no por producto/categoría
  específica) — mantiene el MVP simple; un pedido admite como mucho un cupón aplicado a la vez.
- "Tipo de producto" se trata como sinónimo de categoría — no es un atributo nuevo distinto;
  el alcance de una promoción es producto, marca, o categoría (3 niveles, no 4).
- Cada producto tiene una marca (texto libre, sin gestión de marcas como catálogo propio —
  sin páginas de marca ni CRUD dedicado, solo un campo usado como alcance de promoción).
- Cupones y promociones se combinan sin conflicto: la promoción ya está en el precio unitario
  (aplicada en catálogo), el cupón se aplica sobre el total del pedido — no hay tope conjunto
  ni regla de exclusión entre ambos mecanismos para este MVP.
- No hay generación masiva/programática de cupones (ej. códigos únicos por campaña) —
  creación manual uno por uno vía panel `ADMIN` es suficiente para este MVP.
- No hay validación de zona de cobertura de delivery — cualquier dirección seleccionada en el
  mapa se acepta, consistente con la tarifa fija ya definida (sin variación por distancia).
- No se implementa una libreta de direcciones guardadas/favoritas — cada pedido de delivery
  captura su propia dirección en el momento del checkout.
- Los estados de pedido mínimos son: pendiente, pagado, en preparación, en camino (delivery)
  / listo para recojo (pickup), entregado/recogido, cancelado. El detalle exacto de la
  máquina de estados se define en la fase de planificación.
- Devoluciones y reembolsos están fuera del alcance de esta especificación.
- Un pedido de recojo en local no requiere un `DELIVERY` asignado; solo `ADMIN` lo gestiona.
- La wishlist y el manejo multi-sucursal de inventario (stock por sucursal vs. stock global)
  no son parte de los requisitos funcionales de este MVP; se asume stock global por variante.
