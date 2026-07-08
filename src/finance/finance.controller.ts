import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
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
  @Roles('ADMIN')
  async getTariff() {
    const data = await this.financeService.getTariff();
    return {
      message: 'Lấy cấu hình tài chính & biểu phí thành công!',
      data,
    };
  }

  @Patch('tariff')
  @Roles('ADMIN')
  async updateTariff(@Body() body: Partial<FinanceTariff>) {
    const data = await this.financeService.updateTariff(body);
    return {
      message: 'Cập nhật cấu hình tài chính & biểu phí thành công!',
      data,
    };
  }
}
