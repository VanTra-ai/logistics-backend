import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { ColumnNumericTransformer } from '../common/utils/column-numeric-transformer';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  license_plate!: string;

  // BIKE | VAN | TRUCK
  @Column({ default: 'BIKE' })
  vehicle_type!: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 50,
    transformer: new ColumnNumericTransformer(),
  })
  capacity_weight!: number;

  // ACTIVE | MAINTENANCE | ON_TRIP
  @Column({ default: 'ACTIVE' })
  status!: string;

  // Kho sở hữu xe (có thể chuyển kho khi TRUCK hoàn thành chuyến)
  @ManyToOne(() => Hub, { nullable: true, eager: true })
  hub!: Hub | null;

  // Tài xế mặc định (optional)
  @ManyToOne(() => User, { nullable: true, eager: true })
  assigned_shipper!: User | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
