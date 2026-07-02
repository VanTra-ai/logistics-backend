import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User)
  @JoinColumn()
  user!: User;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  balance!: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  hold_balance!: number;
}
