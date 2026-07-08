import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { Order } from '../orders/order.entity';

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, nullable: true })
  shipment_code!: string | null;

  // Tài xế / Shipper phụ trách chuyến xe
  @ManyToOne(() => User)
  shipper!: User;

  // Biển số xe vận chuyển
  @Column({ nullable: true })
  vehicle_number!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1000 })
  capacity_weight!: number;

  // Bưu cục xuất phát
  @ManyToOne(() => Hub)
  origin_hub!: Hub;

  // Bưu cục đích đến (Có thể null nếu đây là chuyến xe đi giao thẳng cho khách)
  @ManyToOne(() => Hub, { nullable: true })
  destination_hub!: Hub;

  // Trạng thái chuyến xe (PENDING, IN_TRANSIT, COMPLETED)
  @Column({ default: 'PENDING' })
  status!: string;

  // Danh sách các đơn hàng nằm trên chuyến xe này
  @OneToMany(() => Order, (order) => order.shipment)
  orders!: Order[];

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  total_distance!: number;

  @CreateDateColumn()
  created_at!: Date;
}
