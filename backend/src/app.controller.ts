import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

// Controller raíz de ejemplo/placeholder (GET /api/v1/) generado por el CLI de Nest.
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
