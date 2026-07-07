import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MaterialsService } from './materials.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('materials')
@UseGuards(AuthGuard('jwt'))
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  findAll() {
    return this.materialsService.findAll();
  }

  @Post()
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  create(@Body() data: { name: string; price: number; stock: number }) {
    return this.materialsService.create(data);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; price?: number; stock?: number },
  ) {
    return this.materialsService.update(id, data);
  }

  @Delete(':id')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  delete(@Param('id') id: string) {
    return this.materialsService.delete(id);
  }
}

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class PackagingController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post(':id/package')
  @Roles('ADMIN', 'HUB_COORDINATOR', 'SHIPPER')
  @UseGuards(RolesGuard)
  packageOrder(
    @Param('id') id: string,
    @Body('items') items: { materialId: string; quantity: number }[],
  ) {
    return this.materialsService.packageOrder(id, items);
  }
}
