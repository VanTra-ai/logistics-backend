import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditsService } from './audits.service';
import { User } from '../users/user.entity';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('audits')
@UseGuards(AuthGuard('jwt'))
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get()
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  findAll(@Query('hubId') hubId?: string, @Query('status') status?: string) {
    return this.auditsService.findAll(hubId, status);
  }

  @Get(':id')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  findOne(@Param('id') id: string) {
    return this.auditsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  create(
    @Body() data: { zone_filter?: string; hubId?: string },
    @Request() req: { user: User },
  ) {
    return this.auditsService.create(data, req.user);
  }

  @Patch(':id/start')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  start(@Param('id') id: string) {
    return this.auditsService.start(id);
  }

  @Patch(':id/complete')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  complete(@Param('id') id: string) {
    return this.auditsService.complete(id);
  }

  @Post(':id/submit')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  submit(
    @Param('id') id: string,
    @Body('locationBarcode') locationBarcode: string,
    @Body('scannedTrackingNumbers') scannedTrackingNumbers: string[],
  ) {
    return this.auditsService.submit(
      id,
      locationBarcode,
      scannedTrackingNumbers,
    );
  }
}
