import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';
import { Hub } from './hubs/hub.entity';
import { Order } from './orders/order.entity';
import { TrackingHistory } from './trackings/tracking.entity';
import { Shipment } from './shipments/shipment.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { HubsModule } from './hubs/hubs.module';
import { OrdersModule } from './orders/orders.module';
import { TrackingsModule } from './trackings/trackings.module';
import { OrdersPublicController } from './orders/orders-public.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [User, Hub, Order, TrackingHistory, Shipment],
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
    HubsModule,
    OrdersModule,
    TrackingsModule,
  ],
  controllers: [OrdersPublicController],
})
export class AppModule {}
