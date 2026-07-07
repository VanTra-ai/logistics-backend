import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersPublicController } from './orders-public.controller';
import { LabelService } from './label.service';
import { Order } from './order.entity';
import { User } from '../users/user.entity';
import { Wallet } from '../wallets/wallet.entity';
import { Transaction } from '../wallets/transaction.entity';
import { HubsModule } from '../hubs/hubs.module';
import { TrackingsModule } from '../trackings/trackings.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User, Wallet, Transaction]),
    HubsModule,
    TrackingsModule,
    FinanceModule,
  ],
  providers: [OrdersService, LabelService],
  controllers: [
    OrdersController, // API cho Admin/Shipper
    OrdersPublicController, // API cho khách tra cứu
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
