import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TmsController } from './tms.controller';
import { TmsService } from './tms.service';
import { RouteOptimizationService } from './route-optimization.service';
import { Shipment } from '../shipments/shipment.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Shipment, Order, User])],
  controllers: [TmsController],
  providers: [TmsService, RouteOptimizationService],
  exports: [TmsService, RouteOptimizationService],
})
export class TmsModule {}
