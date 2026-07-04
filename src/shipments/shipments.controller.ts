import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ShipmentsService,
  CreateShipmentDto,
  AssignOrdersDto,
  UpdateShipmentStatusDto,
} from './shipments.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @Roles('ADMIN')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async createShipment(@Body() createShipmentDto: CreateShipmentDto) {
    const shipment =
      await this.shipmentsService.createShipment(createShipmentDto);
    return {
      message: 'Tạo chuyến xe vận chuyển mới thành công!',
      data: shipment,
    };
  }

  @Patch(':id/orders')
  @Roles('ADMIN')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async assignOrdersToShipment(
    @Param('id') id: string,
    @Body() assignOrdersDto: AssignOrdersDto,
  ) {
    const result = await this.shipmentsService.assignOrdersToShipment(
      id,
      assignOrdersDto,
    );
    return { data: result };
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SHIPPER')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async updateShipmentStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateShipmentStatusDto,
  ) {
    const result = await this.shipmentsService.updateShipmentStatus(
      id,
      updateStatusDto,
    );
    return { data: result };
  }

  @Delete(':id/orders/:orderId')
  @Roles('ADMIN')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async removeOrderFromShipment(
    @Param('id') id: string,
    @Param('orderId') orderId: string,
  ) {
    const result = await this.shipmentsService.removeOrderFromShipment(
      id,
      orderId,
    );
    return result;
  }
}
