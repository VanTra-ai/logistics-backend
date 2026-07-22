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
import { Location } from '../locations/location.entity';
import { ColumnNumericTransformer } from '../common/utils/column-numeric-transformer';

@Entity('orders')
export class Order {
  @Column({ type: 'timestamp', nullable: true })
  dispatched_at?: Date;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 1. Thông tin vận đơn
  @Column({ unique: true })
  tracking_number!: string;

  @Column({ default: 'PENDING' })
  current_status!: string; // PENDING, PICKING, AT_HUB, DELIVERING, FINISHED, FAILED

  // 2. Thông tin Người gửi
  @Column()
  sender_name!: string;
  @Column()
  sender_phone!: string;
  @Column('text')
  sender_address!: string;

  // Cấu trúc địa giới 2 cấp (Province -> Ward)
  @Column({ nullable: true })
  sender_province_code?: string;
  @Column({ nullable: true })
  sender_ward_code?: string;
  @Column({ nullable: true })
  sender_street?: string;

  // 3. Thông tin Người nhận
  @Column()
  receiver_name!: string;
  @Column()
  receiver_phone!: string;
  @Column('text')
  receiver_address!: string;

  @Column({ nullable: true })
  receiver_province_code?: string;
  @Column({ nullable: true })
  receiver_ward_code?: string;
  @Column({ nullable: true })
  receiver_street?: string;

  // 4. Thông số hàng hóa & Tài chính
  @Column('decimal', {
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  weight!: number; // Khối lượng (kg)

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  cod_amount!: number; // Tiền thu hộ (COD)

  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  length!: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  width!: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  height!: number;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  cod_fee!: number;

  @Column('text', { nullable: true })
  note!: string; // Chú thích của khách hàng

  @Column('text', { nullable: true })
  delivery_image_url!: string; // Hình xác nhận

  // TMS Delivery Coordinates
  @Column('decimal', {
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  latitude!: number;

  @Column('decimal', {
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  longitude!: number;

  @Column({ type: 'int', default: 0 })
  delivery_sequence!: number;

  // Thêm vào bên trong class Order
  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
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

  @ManyToOne(() => Location, { nullable: true, eager: false })
  location!: Location;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  material_fee!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
