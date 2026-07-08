import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('pnl')
  @Roles('ADMIN')
  getPnl(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPnl(startDate, endDate);
  }

  @Get('cod-reconciliation')
  getCodReconciliation() {
    return this.reportsService.getCodReconciliation();
  }

  @Get('heatmap')
  getHeatmap() {
    return this.reportsService.getHeatmap();
  }

  @Get('inventory-aging')
  getInventoryAging() {
    return this.reportsService.getInventoryAging();
  }

  @Get('shipper-kpi')
  getShipperKpi() {
    return this.reportsService.getShipperKpi();
  }

  @Get('warehouse-kpi')
  getWarehouseKpi() {
    return this.reportsService.getWarehouseKpi();
  }
}
