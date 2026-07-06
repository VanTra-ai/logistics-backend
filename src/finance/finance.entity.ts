import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('finance_tariffs')
export class FinanceTariff {
  @PrimaryColumn({ default: 'default' })
  id!: string;

  // 1. Phí Vận chuyển
  @Column('decimal', { precision: 12, scale: 2, default: 15000 })
  base_price_distance!: number; // Giá cước sàn (ví dụ 15,000đ)

  @Column('decimal', { precision: 10, scale: 2, default: 2 })
  base_distance_limit!: number; // Giới hạn km cơ bản (ví dụ 2km)

  @Column('decimal', { precision: 12, scale: 2, default: 4000 })
  block_price_distance!: number; // Giá block km tiếp theo (ví dụ 4,000đ/km)

  // 2. Phí dịch vụ COD
  @Column('decimal', { precision: 5, scale: 2, default: 1.0 })
  cod_fee_percent!: number; // % Phí dịch vụ COD (ví dụ 1.0%)

  // 3. Hoa hồng & Chiết khấu
  @Column('decimal', { precision: 5, scale: 2, default: 15.0 })
  hub_commission_percent!: number; // % Doanh thu chia sẻ cho Bưu cục franchise (ví dụ 15.0%)

  @Column('decimal', { precision: 12, scale: 2, default: 3500 })
  shipper_payout_flat!: number; // Chiết khấu cố định tài xế trên mỗi đơn (ví dụ 3,500đ)

  @Column('decimal', { precision: 5, scale: 2, default: 10.0 })
  shipper_payout_percent!: number; // % Phí giao hàng tài xế nhận (nếu tính theo %)
}
