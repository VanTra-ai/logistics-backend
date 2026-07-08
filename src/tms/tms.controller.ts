import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { TmsService, ConfirmDispatchDto } from './tms.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('tms')
export class TmsController {
  constructor(private readonly tmsService: TmsService) {}

  @Post('auto-dispatch')
  @Roles(Role.ADMIN, Role.HUB_COORDINATOR)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async autoDispatch() {
    return this.tmsService.autoDispatch();
  }

  @Post('confirm-dispatch')
  @Roles(Role.ADMIN, Role.HUB_COORDINATOR)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async confirmDispatch(@Body() confirmDispatchDto: ConfirmDispatchDto) {
    return await this.tmsService.confirmDispatch(confirmDispatchDto);
  }
}
