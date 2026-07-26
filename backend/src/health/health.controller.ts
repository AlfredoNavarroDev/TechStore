import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';

/**
 * GET /health — sin prefijo /api ni versión, usado por Render para health checks
 * (ver docs/DEPLOYMENT.md).
 */
@Controller('health')
export class HealthController {
  @Get()
  @Version(VERSION_NEUTRAL)
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
