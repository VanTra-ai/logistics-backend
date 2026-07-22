import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FinanceTariff } from './finance.entity';

@Controller('finance')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('tariff')
  @Roles('ADMIN', 'HUB_COORDINATOR', 'SHIPPER')
  async getTariff(@Query('hub_id') hubId?: string) {
    const data = await this.financeService.getTariff(hubId);
    return {
      message: 'Lấy cấu hình tài chính & biểu phí thành công!',
      data,
    };
  }

  @Patch('tariff')
  @Roles('ADMIN')
  async updateTariff(
    @Query('hub_id') hubId: string,
    @Body() body: Partial<FinanceTariff>,
    @Request() req: { user: { id: string } },
  ) {
    const userId = req.user.id;
    const data = await this.financeService.updateTariff(hubId, body, userId);
    return {
      message: 'Cập nhật cấu hình tài chính & biểu phí thành công!',
      data,
    };
  }

  @Get('tariff/audits')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  async getAuditLogs(@Query('hub_id') hubId?: string) {
    const data = await this.financeService.getAuditLogs(hubId);
    return {
      message: 'Lấy lịch sử thay đổi biểu phí thành công!',
      data,
    };
  }
}
