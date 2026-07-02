import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { HubsService, CreateHubDto } from './hubs.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('hubs')
export class HubsController {
  constructor(private readonly hubsService: HubsService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Post()
  async createHub(@Body() createHubDto: CreateHubDto) {
    const hub = await this.hubsService.createHub(createHubDto);
    return {
      message: 'Tạo bưu cục thành công!',
      data: hub,
    };
  }

  @Get()
  async getAllHubs() {
    const hubs = await this.hubsService.findAllHubs();
    return {
      message: 'Lấy danh sách bưu cục thành công!',
      data: hubs,
    };
  }
}
