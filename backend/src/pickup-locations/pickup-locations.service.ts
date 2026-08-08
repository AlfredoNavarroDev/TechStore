import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PickupLocation } from './entities/pickup-location.entity';

@Injectable()
export class PickupLocationsService {
  constructor(
    @InjectRepository(PickupLocation)
    private readonly pickupLocationRepository: Repository<PickupLocation>,
  ) {}

  findAll(onlyActive = false): Promise<PickupLocation[]> {
    return this.pickupLocationRepository.find({
      where: onlyActive ? { active: true } : {},
      order: { name: 'ASC' },
    });
  }

  findById(id: string): Promise<PickupLocation | null> {
    return this.pickupLocationRepository.findOne({ where: { id } });
  }

  create(data: { name: string; address: string }): Promise<PickupLocation> {
    const location = this.pickupLocationRepository.create(data);
    return this.pickupLocationRepository.save(location);
  }

  async update(
    id: string,
    data: Partial<Pick<PickupLocation, 'name' | 'address' | 'active'>>,
  ): Promise<PickupLocation> {
    await this.pickupLocationRepository.update(id, data);
    return this.findById(id) as Promise<PickupLocation>;
  }
}
