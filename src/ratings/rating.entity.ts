import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Order)
  @JoinColumn()
  order!: Order;

  @ManyToOne(() => User)
  shipper!: User;

  @Column('int')
  stars!: number;

  @Column('text', { nullable: true })
  comment!: string;

  @CreateDateColumn()
  created_at!: Date;
}
