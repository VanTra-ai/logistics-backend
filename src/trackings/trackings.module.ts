import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingsService } from './trackings.service';
import { TrackingsController } from './trackings.controller';
import { TrackingHistory } from './tracking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TrackingHistory])],
  providers: [TrackingsService],
  controllers: [TrackingsController],
  exports: [TrackingsService],
})
export class TrackingsModule {}
