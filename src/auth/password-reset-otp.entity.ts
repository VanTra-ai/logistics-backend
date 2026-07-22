import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('password_reset_otps')
export class PasswordResetOtp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  email!: string;

  @Column({ length: 6 })
  otp!: string;

  @Column()
  expires_at!: Date;

  @Column({ default: false })
  is_used!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
