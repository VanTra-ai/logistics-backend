import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceTariff } from './finance.entity';
import { FinanceTariffAudit } from './finance-tariff-audit.entity';

@Injectable()
export class FinanceService implements OnModuleInit {
  constructor(
    @InjectRepository(FinanceTariff)
    private readonly tariffRepository: Repository<FinanceTariff>,
    @InjectRepository(FinanceTariffAudit)
    private readonly auditRepository: Repository<FinanceTariffAudit>,
  ) {}

  async onModuleInit() {
    const count = await this.tariffRepository.count({
      where: { hub_id: 'DEFAULT' },
    });
    if (count === 0) {
      const defaultTariff = this.tariffRepository.create({
        hub_id: 'DEFAULT',
        base_price_distance: 15000,
        base_distance_limit: 2,
        block_price_distance: 4000,
        surplus_weight_price: 5000,
        volumetric_divisor: 5000,
        cod_fee_percent: 1.0,
        hub_commission_percent: 15.0,
        shipper_payout_flat: 3500,
        shipper_payout_percent: 10.0,
        shipper_pickup_payout: 2500,
        shipper_return_payout: 2500,
      });
      await this.tariffRepository.save(defaultTariff);
    }
  }

  async getTariff(hubId?: string): Promise<FinanceTariff> {
    if (hubId) {
      const hubTariff = await this.tariffRepository.findOne({
        where: { hub_id: hubId },
      });
      if (hubTariff) return hubTariff;
    }

    // Smart Defaulting: If no hubId provided or no specific tariff found for hub
    let defaultTariff = await this.tariffRepository.findOne({
      where: { hub_id: 'DEFAULT' },
    });
    if (!defaultTariff) {
      defaultTariff = this.tariffRepository.create({
        hub_id: 'DEFAULT',
        base_price_distance: 15000,
        base_distance_limit: 2,
        block_price_distance: 4000,
        surplus_weight_price: 5000,
        volumetric_divisor: 5000,
        cod_fee_percent: 1.0,
        hub_commission_percent: 15.0,
        shipper_payout_flat: 3500,
        shipper_payout_percent: 10.0,
        shipper_pickup_payout: 2500,
        shipper_return_payout: 2500,
      });
      await this.tariffRepository.save(defaultTariff);
    }
    return defaultTariff;
  }

  async updateTariff(
    hubId: string,
    data: Partial<FinanceTariff>,
    userId: string,
  ): Promise<FinanceTariff> {
    const targetHubId = hubId || 'DEFAULT';
    let tariff = await this.tariffRepository.findOne({
      where: { hub_id: targetHubId },
    });
    const oldValues: Record<string, any> = {};

    if (!tariff) {
      tariff = this.tariffRepository.create({ hub_id: targetHubId });
    } else {
      // Capture old values for audit
      for (const key of Object.keys(data)) {
        if (
          key !== 'id' &&
          key !== 'hub_id' &&
          key !== 'created_at' &&
          key !== 'updated_at'
        ) {
          oldValues[key] = {
            old: tariff[key as keyof FinanceTariff],
            new: data[key as keyof Partial<FinanceTariff>],
          };
        }
      }
    }

    Object.assign(tariff, data);
    const savedTariff = await this.tariffRepository.save(tariff);

    // Save Audit
    if (Object.keys(oldValues).length > 0 || !tariff.id) {
      const audit = this.auditRepository.create({
        tariff: savedTariff,
        hub: targetHubId !== 'DEFAULT' ? { id: targetHubId } : undefined,
        hub_id: targetHubId,
        changed_fields: oldValues,
        changed_by: { id: userId },
      });
      await this.auditRepository.save(audit);
    }

    return savedTariff;
  }

  async getAuditLogs(hubId?: string): Promise<FinanceTariffAudit[]> {
    const whereClause = hubId ? { hub_id: hubId } : {};
    return await this.auditRepository.find({
      where: whereClause,
      relations: { changed_by: true },
      order: { created_at: 'DESC' },
    });
  }
}
