import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Ticket } from './ticket.entity';

@Entity('ticket_comments')
export class TicketComment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Ticket, (ticket) => ticket.comments)
  ticket!: Ticket;

  @ManyToOne(() => User)
  user!: User;

  @Column({ default: false })
  is_staff!: boolean;

  @Column('text')
  message!: string;

  @Column('simple-array', { nullable: true })
  attachments!: string[];

  @CreateDateColumn()
  created_at!: Date;
}
