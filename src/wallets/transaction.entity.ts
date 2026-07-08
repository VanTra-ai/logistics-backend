import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { Order } from '../orders/order.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Wallet)
  wallet!: Wallet;

  // Khóa ngoại trỏ về Order để dễ dàng đối soát
  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn()
  order!: Order;

  @Column('decimal', { precision: 15, scale: 2 })
  amount!: number;

  // Semantic enum values: COD_COLLECTED, COD_REMITTED, COMMISSION_EARNED, INCOME_WITHDRAWN
  @Column()
  type!: string;

  @Column('text')
  description!: string;

  @CreateDateColumn()
  created_at!: Date;
}
