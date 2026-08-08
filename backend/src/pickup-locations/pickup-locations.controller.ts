import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PickupLocationsService } from './pickup-locations.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Audited } from '../audit/audited.decorator';

class CreatePickupLocationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;
}

class UpdatePickupLocationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// T070 — CRUD de sucursales (ADMIN). GET público: se necesita para elegir sucursal en checkout.
@Controller({ path: 'pickup-locations', version: '1' })
export class PickupLocationsController {
  constructor(
    private readonly pickupLocationsService: PickupLocationsService,
  ) {}

  @Get()
  @Public()
  findAll() {
    return this.pickupLocationsService.findAll(true);
  }

  @Post()
  @Roles(Role.ADMIN)
  @Audited('PickupLocation')
  create(@Body() dto: CreatePickupLocationDto) {
    return this.pickupLocationsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @Audited('PickupLocation')
  update(@Param('id') id: string, @Body() dto: UpdatePickupLocationDto) {
    return this.pickupLocationsService.update(id, dto);
  }
}
