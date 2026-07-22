import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async findAll(
    @Query('hub_id') hub_id?: string,
    @Query('status') status?: string,
    @Query('vehicle_type') vehicle_type?: string,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return await this.vehiclesService.findAll(
      hub_id,
      status,
      vehicle_type,
      search,
      Number(page),
      Number(limit),
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async findOne(@Param('id') id: string) {
    const data = await this.vehiclesService.findOne(id);
    return { data };
  }

  @Post()
  @Roles('ADMIN')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async create(@Body() dto: CreateVehicleDto) {
    const data = await this.vehiclesService.create(dto);
    return { message: 'Tạo phương tiện thành công!', data };
  }

  @Patch(':id')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    const data = await this.vehiclesService.update(id, dto);
    return { message: 'Cập nhật phương tiện thành công!', data };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async remove(@Param('id') id: string) {
    await this.vehiclesService.remove(id);
    return { message: 'Đã xóa phương tiện!' };
  }
}
