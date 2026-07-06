import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { Shipment } from './shipment.entity';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { TrackingsModule } from '../trackings/trackings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Shipment, User, Hub]), TrackingsModule],
  providers: [ShipmentsService],
  controllers: [ShipmentsController],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
