import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Material } from './material.entity';
import { OrderMaterial } from './order-material.entity';
import { Order } from '../orders/order.entity';
import { MaterialsService } from './materials.service';
import {
  MaterialsController,
  PackagingController,
} from './materials.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Material, OrderMaterial, Order])],
  controllers: [MaterialsController, PackagingController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
