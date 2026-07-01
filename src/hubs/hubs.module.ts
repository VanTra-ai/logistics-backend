import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';
import { Hub } from './hub.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Hub])],
  providers: [HubsService],
  controllers: [HubsController],
  exports: [HubsService],
})
export class HubsModule {}
