import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { HubsService, CreateHubDto, UpdateHubDto } from './hubs.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('hubs')
export class HubsController {
  constructor(private readonly hubsService: HubsService) {}

  @Get()
  async getAllHubs(@Query('page') page = 1, @Query('limit') limit = 10) {
    const result = await this.hubsService.findAllHubs(
      Number(page),
      Number(limit),
    );
    return {
      message: 'Lấy danh sách bưu cục thành công!',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  async getHubDetails(@Param('id') id: string) {
    const hub = await this.hubsService.findById(id);
    return { message: 'Lấy thông tin bưu cục thành công!', data: hub };
  }

  @Post()
  @Roles('ADMIN')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async createHub(@Body() createHubDto: CreateHubDto) {
    const hub = await this.hubsService.createHub(createHubDto);
    return { message: 'Tạo bưu cục mới thành công!', data: hub };
  }

  @Patch(':id')
  @Roles('ADMIN')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async updateHub(@Param('id') id: string, @Body() updateHubDto: UpdateHubDto) {
    const hub = await this.hubsService.updateHub(id, updateHubDto);
    return { message: 'Cập nhật bưu cục thành công!', data: hub };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async deactivateHub(@Param('id') id: string) {
    const hub = await this.hubsService.deactivateHub(id);
    return { message: 'Đã đóng cửa bưu cục an toàn!', data: hub };
  }

  @Get(':id/shipments')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async getHubShipments(@Param('id') id: string) {
    const shipments = await this.hubsService.getHubShipments(id);
    return {
      message: 'Lấy dữ liệu chuyến xe của bưu cục thành công!',
      data: shipments,
    };
  }
}
