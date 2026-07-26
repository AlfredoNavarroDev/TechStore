import { Injectable } from '@nestjs/common';

// Servicio placeholder consumido por AppController.
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
