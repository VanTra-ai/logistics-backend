import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LocationsService } from './locations.service';
import { Location } from './location.entity';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('locations')
@UseGuards(AuthGuard('jwt'))
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  findAll(
    @Query('hubId') hubId?: string,
    @Query('zone') zone?: string,
    @Query('status') status?: string,
  ) {
    return this.locationsService.findAll(hubId, zone, status);
  }

  @Post()
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  create(@Body() data: Partial<Location>) {
    return this.locationsService.create(data);
  }

  @Delete(':id')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  delete(@Param('id') id: string) {
    return this.locationsService.delete(id);
  }
}

// Endpoint PUTAWAY sẽ nằm ở OrdersController nhưng mình có thể tách thành 1 controller riêng cho gọn (hoặc đưa vào đây).
// Theo đúng API spec: PATCH /orders/:id/putaway
@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class PutawayController {
  constructor(private readonly locationsService: LocationsService) {}

  @Patch(':id/putaway')
  @Roles('ADMIN', 'HUB_COORDINATOR', 'SHIPPER')
  @UseGuards(RolesGuard)
  putaway(@Param('id') id: string, @Body('barcode') barcode: string) {
    return this.locationsService.putaway(id, barcode);
  }
}
