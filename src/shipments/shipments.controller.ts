import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Get,
  Request,
  Query,
} from '@nestjs/common';
import {
  ShipmentsService,
  CreateShipmentDto,
  AssignOrdersDto,
  UpdateShipmentStatusDto,
  UpdateShipmentDto,
} from './shipments.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async createShipment(@Body() createShipmentDto: CreateShipmentDto) {
    const shipment =
      await this.shipmentsService.createShipment(createShipmentDto);
    return {
      message: 'Tạo chuyến xe vận chuyển mới thành công!',
      data: shipment,
    };
  }

  @Get()
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async getAllShipments() {
    const data = await this.shipmentsService.findAllShipments();
    return { data };
  }

  @Get('me')
  @Roles('SHIPPER')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async getMyShipments(
    @Request() req: { user: { userId: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('date') date?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    return await this.shipmentsService.findMyShipments(
      req.user.userId,
      pageNum,
      limitNum,
      date,
    );
  }

  @Patch(':id/orders')
  @Roles('ADMIN', 'HUB_COORDINATOR')
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
  @Roles('ADMIN', 'SHIPPER', 'HUB_COORDINATOR')
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
  @Roles('ADMIN', 'HUB_COORDINATOR')
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

  @Patch(':id')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async updateShipment(
    @Param('id') id: string,
    @Body() updateShipmentDto: UpdateShipmentDto,
  ) {
    const result = await this.shipmentsService.updateShipment(
      id,
      updateShipmentDto,
    );
    return {
      message: 'Cập nhật thông tin chuyến xe thành công!',
      data: result,
    };
  }

  @Delete(':id')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async deleteShipment(@Param('id') id: string) {
    return await this.shipmentsService.deleteShipment(id);
  }

  @Patch(':id/cancel')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async cancelShipment(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return await this.shipmentsService.cancelShipment(id, req.user.userId);
  }
}
