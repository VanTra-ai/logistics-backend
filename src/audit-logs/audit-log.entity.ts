import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  userId!: string;

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
