import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceTariff } from './finance.entity';

@Injectable()
export class FinanceService implements OnModuleInit {
  constructor(
    @InjectRepository(FinanceTariff)
    private readonly tariffRepository: Repository<FinanceTariff>,
  ) {}

  async onModuleInit() {
    // Tự động khởi tạo bản ghi mặc định khi module được load nếu chưa tồn tại
    const count = await this.tariffRepository.count();
    if (count === 0) {
      const defaultTariff = this.tariffRepository.create({
        id: 'default',
        base_price_distance: 15000,
        base_distance_limit: 2,
        block_price_distance: 4000,
        cod_fee_percent: 1.0,
        hub_commission_percent: 15.0,
        shipper_payout_flat: 3500,
        shipper_payout_percent: 10.0,
      });
      await this.tariffRepository.save(defaultTariff);
    }
  }

  async getTariff(): Promise<FinanceTariff> {
    let tariff = await this.tariffRepository.findOne({ where: { id: 'default' } });
    if (!tariff) {
      tariff = this.tariffRepository.create({
        id: 'default',
        base_price_distance: 15000,
        base_distance_limit: 2,
        block_price_distance: 4000,
        cod_fee_percent: 1.0,
        hub_commission_percent: 15.0,
        shipper_payout_flat: 3500,
        shipper_payout_percent: 10.0,
      });
      await this.tariffRepository.save(tariff);
    }
    return tariff;
  }

  async updateTariff(data: Partial<FinanceTariff>): Promise<FinanceTariff> {
    const tariff = await this.getTariff();
    Object.assign(tariff, data);
    return await this.tariffRepository.save(tariff);
  }
}
