import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { OrdersExcelService } from './orders-excel.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('exports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ExportsController {
  constructor(private readonly ordersExcelService: OrdersExcelService) {}

  @Get('orders')
  @Roles('ADMIN', 'HUB_COORDINATOR', 'SHIPPER')
  async exportOrders(
    @Query('shipmentId') shipmentId: string,
    @Query('date') date: string,
    @Res() res: Response,
  ) {
    const buffer = await this.ordersExcelService.exportOrders(shipmentId, date);
    const fileName = shipmentId
      ? `bien-ban-${shipmentId}.xlsx`
      : `bao-cao-don-hang-${date || 'all'}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
