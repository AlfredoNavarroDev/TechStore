import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const buildQueryFailedError = (
    code: string,
    constraint?: string,
  ): QueryFailedError => {
    const driverError = {
      code,
      constraint,
      message: 'mensaje técnico crudo de Postgres',
    };
    return new QueryFailedError(
      'SELECT 1',
      [],
      driverError as unknown as Error,
    );
  };

  it('catch: HttpException conocida → responde con su status y body tal cual', () => {
    const exception = new HttpException(
      { statusCode: 400, code: 'X', message: 'y' },
      400,
    );
    filter.catch(exception, host);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'X',
      message: 'y',
    });
  });

  it('catch: QueryFailedError con ERRCODE TS001 (trigger de stock) → InsufficientStockException (409)', () => {
    filter.catch(buildQueryFailedError('TS001'), host);
    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }),
    );
  });

  it('catch: 23514 + chk_fulfillment_consistency → InvalidFulfillmentException (400)', () => {
    filter.catch(
      buildQueryFailedError('23514', 'chk_fulfillment_consistency'),
      host,
    );
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_FULFILLMENT' }),
    );
  });

  it('catch: 23505 + constraint mapeado (UQ_user_email) → DuplicateResourceException (409)', () => {
    filter.catch(buildQueryFailedError('23505', 'UQ_user_email'), host);
    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DUPLICATE_RESOURCE' }),
    );
  });

  it('catch: QueryFailedError no reconocido → 500 genérico, nunca el mensaje crudo de Postgres', () => {
    filter.catch(buildQueryFailedError('99999'), host);
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const [payload] = jsonMock.mock.calls[0] as [Record<string, unknown>];
    expect(payload.message).not.toContain('mensaje técnico crudo de Postgres');
    expect(payload.code).toBe('INTERNAL_ERROR');
  });

  it('catch: error desconocido (no HttpException ni QueryFailedError) → 500 genérico', () => {
    filter.catch(new Error('boom interno'), host);
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const [payload] = jsonMock.mock.calls[0] as [Record<string, unknown>];
    expect(payload.message).not.toContain('boom interno');
  });
});
