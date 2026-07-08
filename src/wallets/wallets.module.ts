import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { Wallet } from './wallet.entity';
import { Transaction } from './transaction.entity';
import { WalletRequest } from './wallet-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, Transaction, WalletRequest])],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
