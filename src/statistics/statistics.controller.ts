import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';

interface RequestWithUser {
  user?: {
    role?: string;
    hubId?: string;
  };
}

@Controller('statistics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('sla-alerts')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  async getSlaAlerts(@Request() req: RequestWithUser) {
    const role = req.user?.role;
    const hubId = role === 'HUB_COORDINATOR' ? req.user?.hubId : undefined;
    const alerts = await this.statisticsService.getSlaAlerts(hubId);
    return {
      message: 'Lấy dữ liệu cảnh báo SLA thành công!',
      data: alerts,
    };
  }
}
