import { HttpException } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super({ statusCode: status, code, message, details }, status);
  }
}
