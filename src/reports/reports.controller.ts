import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('pnl')
  getPnl() {
    return this.reportsService.getPnl();
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
