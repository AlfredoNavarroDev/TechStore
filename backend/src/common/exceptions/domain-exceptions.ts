import { BusinessException } from './business.exception';

export class InsufficientStockException extends BusinessException {
  constructor() {
    super(
      409,
      'INSUFFICIENT_STOCK',
      'No hay suficiente stock disponible para completar esta operación.',
    );
  }
}

export class InvalidFulfillmentException extends BusinessException {
  constructor() {
    super(
      400,
      'INVALID_FULFILLMENT',
      'Elegí recojo en sucursal o delivery con una dirección válida — no ambos, no ninguno.',
    );
  }
}

export class CouponInvalidException extends BusinessException {
  constructor(
    reason: 'EXPIRED' | 'INACTIVE' | 'LIMIT_REACHED' | 'MIN_AMOUNT_NOT_MET',
  ) {
    const messages = {
      EXPIRED: 'Este cupón ya venció.',
      INACTIVE: 'Este cupón ya no está activo.',
      LIMIT_REACHED: 'Este cupón alcanzó su límite de usos.',
      MIN_AMOUNT_NOT_MET:
        'Tu carrito no alcanza el monto mínimo para este cupón.',
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
    super(
      403,
      'ORDER_ACCESS_DENIED',
      'No tenés permiso para ver o modificar este pedido.',
    );
  }
}

export class DeliveryAddressRequiredException extends BusinessException {
  constructor() {
    super(
      400,
      'DELIVERY_ADDRESS_REQUIRED',
      'Elegí una dirección de entrega en el mapa antes de continuar.',
    );
  }
}

export class DuplicateResourceException extends BusinessException {
  constructor(resource: string) {
    super(
      409,
      'DUPLICATE_RESOURCE',
      `Ya existe un/a ${resource} con esos datos.`,
    );
  }
}

export class RefreshTokenReuseException extends BusinessException {
  constructor() {
    super(
      401,
      'SESSION_REVOKED',
      'Tu sesión se cerró por seguridad. Iniciá sesión de nuevo.',
    );
  }
}

export class PaymentFailedException extends BusinessException {
  constructor() {
    super(
      402,
      'PAYMENT_FAILED',
      'El pago no pudo procesarse. Tu carrito sigue intacto, podés reintentar.',
    );
  }
}
