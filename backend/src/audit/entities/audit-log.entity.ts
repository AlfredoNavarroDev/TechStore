import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AuditOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export type AuditEntityType =
  | 'Order'
  | 'Product'
  | 'ProductVariant'
  | 'Category'
  | 'Coupon'
  | 'Promotion'
  | 'PickupLocation';

@Entity('audit_log')
@Index('idx_audit_log_entity', ['entityType', 'entityId', 'createdAt'])
@Index('idx_audit_log_actor', ['actorUserId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'actor_user_id' })
  actorUserId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser: User;

  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType: AuditEntityType;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'enum', enum: AuditOperation, enumName: 'audit_operation' })
  operation: AuditOperation;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, { from: unknown; to: unknown }> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
