import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Audit } from './audit.entity';
import { AuditItem } from './audit-item.entity';
import { Location } from '../locations/location.entity';
import { Order } from '../orders/order.entity';
import { AuditsService } from './audits.service';
import { AuditsController } from './audits.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Audit, AuditItem, Location, Order])],
  controllers: [AuditsController],
  providers: [AuditsService],
  exports: [AuditsService],
})
export class AuditsModule {}
