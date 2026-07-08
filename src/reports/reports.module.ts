import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { DailyStats } from './daily-stat.entity';
import { Order } from '../orders/order.entity';
import { Location } from '../locations/location.entity';
import { Shipment } from '../shipments/shipment.entity';
import { AuditLog } from '../audit-logs/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyStats, Order, Location, Shipment, AuditLog]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
