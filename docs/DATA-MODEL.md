# Data Model — TechStore

Base de datos: Neon Postgres, acceso vía TypeORM. Diagrama en Mermaid (renderiza en GitHub/GitLab nativamente).

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER ||--o| CART : has
    USER ||--o{ WISHLIST_ITEM : saves

    CATEGORY ||--o{ CATEGORY : "sub-categoría de"
    CATEGORY ||--o{ PRODUCT : contains

    PRODUCT ||--o{ PRODUCT_VARIANT : has
    PRODUCT ||--o{ WISHLIST_ITEM : "referenced by"

    PRODUCT_VARIANT ||--o{ CART_ITEM : "referenced by"
    PRODUCT_VARIANT ||--o{ ORDER_ITEM : "referenced by"

    CART ||--o{ CART_ITEM : contains

    ORDER ||--o{ ORDER_ITEM : contains
    ORDER ||--o| PAYMENT : "paid via"
    ORDER }o--o| PICKUP_LOCATION : "recojo en"
    ORDER }o--o| COUPON : "aplica"

    USER {
        uuid id PK
        string email
        string passwordHash
        string name
        enum role "customer|admin"
        timestamp createdAt
    }

    CATEGORY {
        uuid id PK
        string name
        string slug
        uuid parentId FK "nullable, self-ref"
    }

    PRODUCT {
        uuid id PK
        uuid categoryId FK
        string name
        string slug
        string brand
        text description
        jsonb specs "specs base: chipset, socket, etc"
        decimal basePrice
        boolean isActive
    }

    PRODUCT_VARIANT {
        uuid id PK
        uuid productId FK
        string sku
        jsonb attributes "RAM, almacenamiento, color..."
        decimal priceOverride "nullable"
        int stock
    }

    PICKUP_LOCATION {
        uuid id PK
        string name
        string address
        string schedule
        boolean isActive
    }

    CART {
        uuid id PK
        uuid userId FK "nullable si es guest (vive en Redis)"
        timestamp updatedAt
    }

    CART_ITEM {
        uuid id PK
        uuid cartId FK
        uuid productVariantId FK
        int quantity
        decimal unitPriceSnapshot
    }

    ORDER {
        uuid id PK
        uuid userId FK
        enum fulfillmentType "DELIVERY|PICKUP"
        enum status "PENDING|PAID|SHIPPED|READY_FOR_PICKUP|COMPLETED|CANCELLED"
        string deliveryAddress "nullable, solo DELIVERY"
        decimal shippingFee "tarifa fija, 0 si PICKUP"
        uuid pickupLocationId FK "nullable, solo PICKUP"
        uuid couponId FK "nullable"
        decimal subtotal
        decimal discount
        decimal total
        timestamp createdAt
    }

    ORDER_ITEM {
        uuid id PK
        uuid orderId FK
        uuid productVariantId FK
        int quantity
        decimal unitPriceSnapshot
    }

    COUPON {
        uuid id PK
        string code
        enum discountType "PERCENTAGE|FIXED"
        decimal value
        timestamp expiresAt
        int maxUses
        int usedCount
    }

    PAYMENT {
        uuid id PK
        uuid orderId FK
        string stripeSessionId
        string stripePaymentIntentId "nullable"
        enum status "PENDING|SUCCEEDED|FAILED"
        decimal amount
        timestamp createdAt
    }

    WISHLIST_ITEM {
        uuid id PK
        uuid userId FK
        uuid productId FK
        timestamp createdAt
    }
```

## Notas de diseño

- **Snapshots de precio**: `CART_ITEM.unitPriceSnapshot` y `ORDER_ITEM.unitPriceSnapshot` congelan el precio al momento de agregar/ordenar — cambios posteriores en `PRODUCT_VARIANT.priceOverride` no afectan carritos/órdenes existentes.
- **Guest cart**: no existe fila `CART` en Postgres para invitados; vive en Redis (`cart:guest:<cartId>`) y se migra a `CART` + `CART_ITEM` al iniciar sesión.
- **Stock**: vive en `PRODUCT_VARIANT.stock`, decrementado al confirmar pago (`Order.status = PAID`), no al agregar al carrito.
- **fulfillmentType**: `DELIVERY` requiere `deliveryAddress` + `shippingFee` fijo; `PICKUP` requiere `pickupLocationId`, `shippingFee = 0`.
- **Sin módulo reviews**: descartado explícitamente del alcance.
- Índices recomendados: `PRODUCT.slug` (unique), `PRODUCT.categoryId`, `PRODUCT_VARIANT.sku` (unique), `ORDER.userId`, `ORDER.status`, `COUPON.code` (unique).
