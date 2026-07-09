import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ColumnNumericTransformer } from '../common/utils/column-numeric-transformer';

// Bảng vật tư đóng gói (Thùng gỗ, Màng xốp...)
@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Tên vật tư
  @Column()
  name!: string;

  // Đơn giá
  @Column('decimal', {
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  price!: number;

  // Tồn kho vật tư
  @Column({ default: 0 })
  stock!: number;

  // Trạng thái: ACTIVE | INACTIVE
  @Column({ default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
