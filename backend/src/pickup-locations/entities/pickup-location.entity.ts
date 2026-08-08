import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pickup_location')
export class PickupLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500 })
  address: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
