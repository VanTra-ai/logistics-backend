import { Controller, Post, UseGuards } from '@nestjs/common';
import { TmsService } from './tms.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('tms')
export class TmsController {
  constructor(private readonly tmsService: TmsService) {}

  @Post('auto-dispatch')
  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async autoDispatch() {
    return this.tmsService.autoDispatch();
  }
}
