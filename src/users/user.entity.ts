import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Hub } from '../hubs/hub.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ unique: true })
  phone_number!: string;

  @Column()
  password_hash!: string;

  @Column()
  full_name!: string;

  @Column({ default: 'ACTIVE' })
  status!: string;

  @Column()
  role!: string;

  @Column({ nullable: true })
  refresh_token!: string;

  @Column({ nullable: true })
  device_token!: string;

  @Column({ default: 'UNVERIFIED' })
  ekyc_status!: string;

  @Column({ nullable: true })
  cccd_number!: string;

  @ManyToOne(() => Hub, { nullable: true })
  hub!: Hub;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
