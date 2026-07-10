import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { Location } from '../locations/location.entity';
import { Shipment } from '../shipments/shipment.entity';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { HubStatisticsController } from './hub-statistics.controller';
import { HubStatisticsService } from './hub-statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, Hub, Location, Shipment])],
  controllers: [StatisticsController, HubStatisticsController],
  providers: [StatisticsService, HubStatisticsService],
})
export class StatisticsModule {}
