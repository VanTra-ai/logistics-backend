import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';

@Controller('statistics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('sla-alerts')
  async getSlaAlerts() {
    const alerts = await this.statisticsService.getSlaAlerts();
    return {
      message: 'Lấy dữ liệu cảnh báo SLA thành công!',
      data: alerts,
    };
  }
}
