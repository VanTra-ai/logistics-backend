import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

@Entity('order_incidents')
export class OrderIncident {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, { eager: true })
  order!: Order;

  @ManyToOne(() => User, { eager: true })
  shipper!: User;

  @Column()
  reason!: string;

  @Column('text')
  description!: string;

  @Column({ nullable: true })
  proof_image_url!: string;

  @Column({ default: 'PENDING' })
  status!: string;

  @Column('text', { nullable: true })
  resolution_notes!: string;

  @ManyToOne(() => User, { nullable: true })
  resolvedBy!: User;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
