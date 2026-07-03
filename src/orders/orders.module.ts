import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersPublicController } from './orders-public.controller';
import { Order } from './order.entity';
import { User } from '../users/user.entity';
import { HubsModule } from '../hubs/hubs.module';
import { TrackingsModule } from '../trackings/trackings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User]),
    HubsModule,
    TrackingsModule,
  ],
  providers: [OrdersService],
  controllers: [
    OrdersController, // API cho Admin/Shipper
    OrdersPublicController, // API cho khách tra cứu
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
