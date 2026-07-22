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
import { Vehicle } from '../vehicles/vehicle.entity';
import { ColumnNumericTransformer } from '../common/utils/column-numeric-transformer';

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  shipment_code!: string | null;

  // Tài xế / Shipper phụ trách chuyến xe
  @ManyToOne(() => User)
  shipper!: User;

  // Biển số xe vận chuyển
  @Column({ nullable: true })
  vehicle_number!: string;

  // Loại phương tiện: BIKE hoặc TRUCK
  @Column({ default: 'TRUCK' })
  vehicle_type!: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 1000,
    transformer: new ColumnNumericTransformer(),
  })
  capacity_weight!: number;

  // Bưu cục xuất phát
  @ManyToOne(() => Hub)
  origin_hub!: Hub;

  // Bưu cục đích đến (Có thể null nếu đây là chuyến xe đi giao thẳng cho khách)
  @ManyToOne(() => Hub, { nullable: true })
  destination_hub!: Hub;

  // Trạng thái chuyến xe (PENDING, IN_TRANSIT, COMPLETED, CANCELLED)
  @Column({ default: 'PENDING' })
  status!: string;

  // Loại chuyến xe: PICKUP (lấy hàng), DELIVERY (giao hàng), RETURN (hoàn hàng)
  @Column({ default: 'DELIVERY' })
  type!: string;

  // Phương tiện được sử dụng (link tới Vehicle master data)
  @ManyToOne(() => Vehicle, { nullable: true })
  vehicle!: Vehicle | null;

  // Danh sách các đơn hàng nằm trên chuyến xe này
  @OneToMany(() => Order, (order) => order.shipment)
  orders!: Order[];

  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  total_distance!: number;

  @CreateDateColumn()
  created_at!: Date;
}
