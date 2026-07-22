import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { Shipment } from './shipment.entity';
import { DeliveryAttempt } from './delivery-attempt.entity';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { TrackingsModule } from '../trackings/trackings.module';
import { LocationsModule } from '../locations/locations.module';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shipment, DeliveryAttempt, User, Hub]),
    TrackingsModule,
    LocationsModule,
    VehiclesModule,
  ],
  providers: [ShipmentsService],
  controllers: [ShipmentsController],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
