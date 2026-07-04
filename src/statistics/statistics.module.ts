import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, Hub])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
