import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './order.entity';
import { HubsModule } from '../hubs/hubs.module';
import { TrackingsModule } from '../trackings/trackings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), HubsModule, TrackingsModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
