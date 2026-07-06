import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './users/user.entity';
import { Hub } from './hubs/hub.entity';
import { Order } from './orders/order.entity';
import { TrackingHistory } from './trackings/tracking.entity';
import { Shipment } from './shipments/shipment.entity';
import { Address } from './addresses/address.entity';
import { Wallet } from './wallets/wallet.entity';
import { Transaction } from './wallets/transaction.entity';
import { Rating } from './ratings/rating.entity';
import { Ticket } from './tickets/ticket.entity';
import { FinanceTariff } from './finance/finance.entity';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { HubsModule } from './hubs/hubs.module';
import { OrdersModule } from './orders/orders.module';
import { TrackingsModule } from './trackings/trackings.module';
import { TicketsModule } from './tickets/tickets.module';
import { RatingsModule } from './ratings/ratings.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { StatisticsModule } from './statistics/statistics.module';
import { FinanceModule } from './finance/finance.module';

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
      entities: [
        User,
        Hub,
        Order,
        TrackingHistory,
        Shipment,
        Address,
        Wallet,
        Transaction,
        Rating,
        Ticket,
        FinanceTariff,
      ],
      synchronize: true, // TypeORM sẽ tự tạo bảng mới dựa trên các Entity này
    }),
    UsersModule,
    AuthModule,
    HubsModule,
    OrdersModule,
    TrackingsModule,
    TicketsModule,
    RatingsModule,
    ShipmentsModule,
    StatisticsModule,
    FinanceModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
