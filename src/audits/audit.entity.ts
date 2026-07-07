import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { AuditItem } from './audit-item.entity';

// Bảng phiên kiểm kê kho
@Entity('audits')
export class Audit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Trạng thái: DRAFT | IN_PROGRESS | COMPLETED
  @Column({ default: 'DRAFT' })
  status!: string;

  // Lọc theo khu vực (tùy chọn)
  @Column({ nullable: true })
  zone_filter!: string;

  // Người tạo phiên kiểm kê
  @ManyToOne(() => User)
  created_by!: User;

  // Hub thực hiện kiểm kê
  @ManyToOne(() => Hub, { nullable: true })
  hub!: Hub;

  // Danh sách các mục kiểm kê
  @OneToMany(() => AuditItem, (ai) => ai.audit, { cascade: true })
  items!: AuditItem[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
