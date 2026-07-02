import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User)
  user!: User;

  @Column()
  title!: string;

  @Column()
  contact_name!: string;

  @Column()
  contact_phone!: string;

  @Column('text')
  full_address!: string;

  @Column({ default: false })
  is_default!: boolean;
}
