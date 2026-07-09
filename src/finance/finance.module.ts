import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceTariff } from './finance.entity';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { FinanceTariffAudit } from './finance-tariff-audit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FinanceTariff, FinanceTariffAudit])],
  providers: [FinanceService],
  controllers: [FinanceController],
  exports: [FinanceService],
})
export class FinanceModule {}
