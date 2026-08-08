import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PickupLocation } from './entities/pickup-location.entity';
import { PickupLocationsService } from './pickup-locations.service';
import { PickupLocationsController } from './pickup-locations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PickupLocation])],
  controllers: [PickupLocationsController],
  providers: [PickupLocationsService],
  exports: [PickupLocationsService],
})
export class PickupLocationsModule {}
