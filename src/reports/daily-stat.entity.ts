import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('daily_stats')
export class DailyStats {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'date', unique: true })
  date!: Date;

  @Column({ type: 'int', default: 0 })
  total_orders!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_revenue!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_costs!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
