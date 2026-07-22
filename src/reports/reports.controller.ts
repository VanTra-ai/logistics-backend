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
  @Roles('ADMIN')
  getShipperKpi(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.getShipperLeaderboard(
      startDate,
      endDate,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Get('warehouse-kpi')
  @Roles('ADMIN')
  getWarehouseKpi(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getHubPerformance(startDate, endDate);
  }

  @Get('pnl-by-hub')
  @Roles('ADMIN')
  getPnlByHub(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPnlByHub(startDate, endDate);
  }
}
