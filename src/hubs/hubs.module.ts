import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hub } from './hub.entity';
import { Order } from '../orders/order.entity';
import { Shipment } from '../shipments/shipment.entity';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Hub, Order, Shipment])],
  providers: [HubsService],
  controllers: [HubsController],
  exports: [HubsService],
})
export class HubsModule {}
