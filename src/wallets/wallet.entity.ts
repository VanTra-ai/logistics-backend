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
  income_balance!: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  cod_debt!: number;
}
