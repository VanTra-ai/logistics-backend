import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { Shipment } from '../shipments/shipment.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 1. Thông tin vận đơn
  @Column({ unique: true })
  tracking_number!: string;

  @Column({ default: 'PENDING' })
  current_status!: string; // PENDING, PICKING, DELIVERING, FINISHED, FAILED

  // 2. Thông tin Người gửi
  @Column()
  sender_name!: string;
  @Column()
  sender_phone!: string;
  @Column('text')
  sender_address!: string;

  // 3. Thông tin Người nhận
  @Column()
  receiver_name!: string;
  @Column()
  receiver_phone!: string;
  @Column('text')
  receiver_address!: string;

  // 4. Thông số hàng hóa & Tài chính
  @Column('decimal', { precision: 10, scale: 2 })
  weight!: number; // Khối lượng (kg)

  @Column('decimal', { precision: 12, scale: 2 })
  cod_amount!: number; // Tiền thu hộ (COD)

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  length!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  width!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  height!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  cod_fee!: number;

  @Column('text', { nullable: true })
  note!: string; // Chú thích của khách hàng

  @Column('text', { nullable: true })
  delivery_image_url!: string; // Hình xác nhận

  // Thêm vào bên trong class Order
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  shipping_fee!: number;

  @Column({ default: 'PENDING' })
  cod_status!: string;

  @DeleteDateColumn()
  deleted_at?: Date;

  // 5. Quan hệ
  @ManyToOne(() => User, { nullable: true })
  shipper!: User;

  @ManyToOne(() => Hub)
  pickup_hub!: Hub;

  @ManyToOne(() => User, { nullable: true })
  customer!: User;

  @ManyToOne(() => Shipment, (shipment) => shipment.orders, { nullable: true })
  shipment!: Shipment;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
