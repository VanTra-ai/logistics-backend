import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
import { TicketComment } from './ticket-comment.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User)
  customer!: User;

  @ManyToOne(() => Order, { nullable: true })
  order!: Order;

  @Column()
  issue_type!: string;

  @Column('text')
  description!: string;

  // Mảng lưu URL hình ảnh bằng chứng (ảnh hàng vỡ,...)
  @Column('simple-array', { nullable: true })
  evidence_images!: string[];

  @Column({ default: 'OPEN' })
  status!: string;

  @Column('text', { nullable: true })
  admin_response!: string;

  @OneToMany(() => TicketComment, (comment) => comment.ticket)
  comments!: TicketComment[];

  @CreateDateColumn()
  created_at!: Date;
}
