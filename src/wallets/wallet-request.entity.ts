import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('wallet_requests')
export class WalletRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { eager: true })
  user!: User;

  @Column({ default: 'PENDING' })
  status!: string; // PENDING, APPROVED, REJECTED

  @Column()
  type!: string; // WITHDRAW, REMIT

  @Column('decimal', { precision: 12, scale: 2 })
  amount!: number;

  @Column('simple-json', { nullable: true })
  order_ids!: string[]; // Danh sách các ID đơn hàng khi nộp COD

  @Column({ nullable: true })
  bank_account_info!: string; // Thông tin ngân hàng khi rút tiền

  @Column({ nullable: true })
  remarks!: string; // Ghi chú (Mã GD ngân hàng, lý do từ chối...)

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
