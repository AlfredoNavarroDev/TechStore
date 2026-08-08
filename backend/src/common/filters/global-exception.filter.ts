import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { BusinessException } from '../exceptions/business.exception';
import {
  DuplicateResourceException,
  InsufficientStockException,
  InvalidFulfillmentException,
} from '../exceptions/domain-exceptions';

/**
 * Mapea el nombre de constraint de Postgres (23505 unique_violation) al recurso
 * legible que se muestra en DuplicateResourceException. Los nombres deben coincidir
 * exactamente con los que se declaran en las migraciones (research.md §15).
 */
const UNIQUE_CONSTRAINT_RESOURCE: Record<string, string> = {
  UQ_user_email: 'usuario con ese email',
  UQ_coupon_code: 'cupón con ese código',
  UQ_payment_provider_session_id: 'pago',
  UQ_category_slug: 'categoría con ese slug',
  UQ_category_name: 'categoría con ese nombre',
};

/**
 * Postgres SQLSTATE de check_violation. Ver research.md §15 — el nombre de
 * constraint (no el mensaje) decide a qué excepción de dominio se traduce.
 */
const CHECK_VIOLATION_SQLSTATE = '23514';
const UNIQUE_VIOLATION_SQLSTATE = '23505';
const CUSTOM_STOCK_SQLSTATE = 'TS001';

interface PgDriverError {
  code?: string;
  constraint?: string;
}

/**
 * Filtro global de errores. Ningún error crudo de Postgres/TypeORM debe llegar
 * al cliente — todo pasa por acá (research.md §15, tasks T017-T018).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
      return;
    }

    if (exception instanceof QueryFailedError) {
      const translated = this.translatePostgresError(exception);
      if (translated) {
        const status = translated.getStatus();
        response.status(status).json(translated.getResponse());
        return;
      }
    }

    // No reconocido: nunca exponer message/stack crudo al cliente (nestjs-pro
    // §Pre-Deploy Checklist — "Stack traces not exposed in error responses").
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error inesperado, intentá de nuevo.',
    });
  }

  /** research.md §15 — tabla de mapeo SQLSTATE/constraint → excepción de dominio. */
  private translatePostgresError(
    error: QueryFailedError<Error>,
  ): BusinessException | null {
    const driverError = error.driverError as PgDriverError | undefined;
    const code = driverError?.code;
    const constraint = driverError?.constraint;

    if (code === CUSTOM_STOCK_SQLSTATE) {
      return new InsufficientStockException();
    }

    if (code === CHECK_VIOLATION_SQLSTATE) {
      if (constraint === 'chk_stock_non_negative') {
        return new InsufficientStockException();
      }
      if (constraint === 'chk_fulfillment_consistency') {
        return new InvalidFulfillmentException();
      }
      if (constraint === 'chk_coupon_usage') {
        // No debería dispararse nunca — el trigger ya previene pasarse del límite.
        // Si pasa, es señal de bug: se loguea para investigar, se responde genérico.
        this.logger.error(
          `chk_coupon_usage violado — el trigger de redención debió prevenir esto: ${error.message}`,
        );
        return new BusinessException(
          409,
          'COUPON_USAGE_INCONSISTENT',
          'No se pudo aplicar el cupón, intentá de nuevo.',
        );
      }
    }

    if (code === UNIQUE_VIOLATION_SQLSTATE && constraint) {
      const resource = UNIQUE_CONSTRAINT_RESOURCE[constraint];
      if (resource) {
        return new DuplicateResourceException(resource);
      }
    }

    return null;
  }
}
