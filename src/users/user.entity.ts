import { Exclude } from 'class-transformer';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Hub } from '../hubs/hub.entity';
import { ColumnNumericTransformer } from '../common/utils/column-numeric-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  employee_code!: string | null;

  @Column({ unique: true })
  email!: string;

  @Column({ unique: true })
  phone_number!: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column('decimal', {
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  current_latitude!: number | null;

  @Column('decimal', {
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  current_longitude!: number | null;

  @Column()
  @Exclude()
  password_hash!: string;

  @Column()
  full_name!: string;

  @Column({ default: 'ACTIVE' })
  status!: string;

  @Column({ default: 'CUSTOMER' })
  role!: 'ADMIN' | 'SHIPPER' | 'HUB_COORDINATOR' | 'CUSTOMER';

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  refresh_token!: string | null;

  @Column({ nullable: true })
  device_token!: string;

  @Column({ default: 'UNVERIFIED' })
  ekyc_status!: string;

  @Column({ nullable: true })
  cccd_number!: string;

  @ManyToOne(() => Hub, { nullable: true })
  hub!: Hub;

  @Column({ nullable: true })
  vehicle_number!: string;

  @Column({ default: 'BIKE' })
  vehicle_type!: string;

  @Column({ default: false })
  is_online!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_heartbeat!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
