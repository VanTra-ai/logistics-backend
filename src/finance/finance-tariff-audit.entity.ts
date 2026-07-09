import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { FinanceTariff } from './finance.entity';

@Entity('finance_tariff_audits')
export class FinanceTariffAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => FinanceTariff, { onDelete: 'CASCADE' })
  tariff!: FinanceTariff;

  @ManyToOne(() => Hub, { nullable: true, onDelete: 'SET NULL' })
  hub!: Hub;

  @Column({ default: 'DEFAULT' })
  hub_id!: string; // Lưu lại hub_id text để dễ query kể cả khi hub bị xóa

  @Column('jsonb')
  changed_fields!: Record<string, any>; // Lưu thông tin các trường thay đổi (oldValue -> newValue)

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  changed_by!: User;

  @CreateDateColumn()
  created_at!: Date;
}
