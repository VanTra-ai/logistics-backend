import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { ColumnNumericTransformer } from '../common/utils/column-numeric-transformer';

@Entity('tracking_history')
export class TrackingHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Quan hệ với đơn hàng để biết đây là lịch sử của đơn nào
  @ManyToOne(() => Order, (order) => order.id)
  order!: Order;

  // Trạng thái của đơn hàng tại thời điểm này (PENDING, DELIVERING, FINISHED...)
  @Column()
  status!: string;

  // Ghi chú thêm cho trạng thái đó (ví dụ: "Shipper đã gọi nhưng khách không bắt máy")
  @Column('text', { nullable: true })
  note!: string;

  // Tọa độ GPS để vẽ lộ trình di chuyển (thời gian thực)
  @Column('decimal', {
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  lat!: number;

  @Column('decimal', {
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  long!: number;

  @Column('text', { nullable: true })
  image_url!: string;

  // Thời điểm xảy ra sự kiện
  @CreateDateColumn()
  created_at!: Date;
}
