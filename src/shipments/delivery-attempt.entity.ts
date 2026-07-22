import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { Shipment } from './shipment.entity';
import { User } from '../users/user.entity';

@Entity('delivery_attempts')
export class DeliveryAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  order!: Order;

  @ManyToOne(() => Shipment, { onDelete: 'CASCADE' })
  shipment!: Shipment;

  @ManyToOne(() => User)
  shipper!: User;

  @Column({ default: 'PENDING' })
  status!: string; // PENDING, IN_TRANSIT, FINISHED, FAILED, REMOVED

  @Column('text', { nullable: true })
  failure_reason!: string; // Lí do thất bại nếu có

  @Column('text', { nullable: true })
  proof_image_url!: string; // Hình ảnh bằng chứng của lần giao này

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
