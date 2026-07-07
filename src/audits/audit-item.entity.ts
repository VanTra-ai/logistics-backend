import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Audit } from './audit.entity';
import { Location } from '../locations/location.entity';

// Bảng chi tiết mục kiểm kê từng vị trí
@Entity('audit_items')
export class AuditItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Phiên kiểm kê cha
  @ManyToOne(() => Audit, (a) => a.items)
  audit!: Audit;

  // Vị trí kệ được kiểm tra
  @ManyToOne(() => Location, { eager: true })
  location!: Location;

  // ID đơn hàng kỳ vọng tại vị trí này
  @Column({ nullable: true })
  expected_order_id!: string;

  // ID đơn hàng thực tế quét được
  @Column({ nullable: true })
  scanned_order_id!: string;

  // Mã vận đơn kỳ vọng
  @Column({ nullable: true })
  expected_tracking!: string;

  // Mã vận đơn thực tế quét được
  @Column({ nullable: true })
  scanned_tracking!: string;

  // Trạng thái: PENDING | MATCHED | MISSING | WRONG_LOCATION
  @Column({ default: 'PENDING' })
  status!: string;

  @CreateDateColumn()
  created_at!: Date;
}
