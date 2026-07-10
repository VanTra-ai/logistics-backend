import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { HubStatisticsService } from './hub-statistics.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '../common/enums/role.enum';

interface RequestWithUser {
  user?: {
    role?: string;
    hubId?: string;
  };
}

@Controller('statistics/hub')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class HubStatisticsController {
  constructor(private readonly hubStatisticsService: HubStatisticsService) {}

  @Get('overview')
  @Roles(Role.ADMIN, Role.HUB_COORDINATOR)
  async getOverview(
    @Request() req: RequestWithUser,
    @Query('hubId') queryHubId?: string,
  ) {
    const role = req.user?.role;
    // If ADMIN and queryHubId is provided, use it. Otherwise, use the user's hubId (for HUB_COORDINATOR).
    const hubId = role === 'ADMIN' && queryHubId ? queryHubId : req.user?.hubId;
    const data = await this.hubStatisticsService.getOverview(hubId as string);
    return {
      message: 'Lấy dữ liệu tổng quan bưu cục thành công!',
      data,
    };
  }

  @Get('shipment-monitor')
  @Roles(Role.ADMIN, Role.HUB_COORDINATOR)
  async getShipmentMonitor(
    @Request() req: RequestWithUser,
    @Query('hubId') queryHubId?: string,
  ) {
    const role = req.user?.role;
    const hubId = role === 'ADMIN' && queryHubId ? queryHubId : req.user?.hubId;
    const data = await this.hubStatisticsService.getShipmentMonitor(
      hubId as string,
    );
    return {
      message: 'Lấy dữ liệu chuyến xe thành công!',
      data,
    };
  }
}
