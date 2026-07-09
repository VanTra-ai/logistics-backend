import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { Material } from './material.entity';
import { ColumnNumericTransformer } from '../common/utils/column-numeric-transformer';

// Bảng liên kết vật tư đóng gói với đơn hàng
@Entity('order_materials')
export class OrderMaterial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Đơn hàng sử dụng vật tư
  @ManyToOne(() => Order)
  order!: Order;

  // Vật tư được sử dụng
  @ManyToOne(() => Material, { eager: true })
  material!: Material;

  // Số lượng sử dụng
  @Column({ default: 1 })
  quantity!: number;

  // Đơn giá tại thời điểm sử dụng
  @Column('decimal', {
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  unit_price!: number;

  @CreateDateColumn()
  created_at!: Date;
}
