import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  userId!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  action!: string;

  @Column({ nullable: true })
  subAction!: string;

  @Column()
  entityName!: string;

  @Column()
  entityId!: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValues!: any;

  @Column({ type: 'jsonb', nullable: true })
  newValues!: any;

  @CreateDateColumn()
  createdAt!: Date;
}
