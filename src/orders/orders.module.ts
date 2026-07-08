import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersPublicController } from './orders-public.controller';
import { ExportsController } from './exports.controller';
import { LabelService } from './label.service';
import { OrdersExcelService } from './orders-excel.service';
import { Order } from './order.entity';
import { User } from '../users/user.entity';
import { Wallet } from '../wallets/wallet.entity';
import { Transaction } from '../wallets/transaction.entity';
import { HubsModule } from '../hubs/hubs.module';
import { TrackingsModule } from '../trackings/trackings.module';
import { FinanceModule } from '../finance/finance.module';
import { OrdersListener } from './orders.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User, Wallet, Transaction]),
    HubsModule,
    TrackingsModule,
    FinanceModule,
  ],
  providers: [OrdersService, LabelService, OrdersExcelService, OrdersListener],
  controllers: [
    OrdersController, // API cho Admin/Shipper
    OrdersPublicController, // API cho khách tra cứu
    ExportsController, // API cho Export Excel
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
