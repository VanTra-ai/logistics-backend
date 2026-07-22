import {
  Entity,
  Column,
  PrimaryColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('vietnam_provinces')
export class VietnamProvince {
  @PrimaryColumn()
  code!: string; // Mã tỉnh (ví dụ: "79")

  @Column()
  name!: string; // Tên đầy đủ (ví dụ: "Thành phố Hồ Chí Minh")

  @OneToMany(() => VietnamWard, (ward) => ward.province)
  wards!: VietnamWard[];
}

@Entity('vietnam_wards')
export class VietnamWard {
  @PrimaryColumn()
  code!: string; // Mã xã/phường

  @Column()
  name!: string; // Tên xã/phường

  @Column()
  province_code!: string;

  @ManyToOne(() => VietnamProvince, (province) => province.wards)
  @JoinColumn({ name: 'province_code' })
  province!: VietnamProvince;
}
