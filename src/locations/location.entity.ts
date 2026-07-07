import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Hub } from '../hubs/hub.entity';
import { Order } from '../orders/order.entity';

// Bảng vị trí lưu trữ hàng trong kho
@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Khu vực (A, B, C...)
  @Column()
  zone!: string;

  // Dãy kệ (01, 02...)
  @Column()
  aisle!: string;

  // Tầng kệ (1, 2, 3...)
  @Column()
  shelf!: string;

  // Ngăn (A, B, C...)
  @Column()
  bin!: string;

  // Mã vạch dán trên kệ
  @Column({ unique: true })
  barcode!: string;

  // Trạng thái: EMPTY | OCCUPIED | FULL
  @Column({ default: 'EMPTY' })
  status!: string;

  // Số đơn tối đa trên kệ
  @Column({ default: 1 })
  max_capacity!: number;

  // Kệ thuộc hub nào
  @ManyToOne(() => Hub, { nullable: true })
  hub!: Hub;

  // Danh sách đơn hàng trên kệ
  @OneToMany(() => Order, (o) => o.location)
  orders!: Order[];

  @CreateDateColumn()
  created_at!: Date;
}
