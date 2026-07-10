import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('wallets')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @Roles('ADMIN', 'HUB_COORDINATOR')
  async findAll(
    @Request() req: { user: { role: string; hubId?: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('hubId') hubIdFilter?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    return await this.walletsService.findAll(
      req.user,
      pageNum,
      limitNum,
      search,
      hubIdFilter,
    );
  }

  @Get('me')
  @Roles('SHIPPER')
  async findMyWallet(@Request() req: { user: { sub: string } }) {
    return await this.walletsService.findMyWallet(req.user.sub);
  }

  @Get('requests')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  async getRequests(
    @Request() req: { user: { role: string; hubId?: string } },
  ) {
    return await this.walletsService.getRequests(req.user);
  }

  @Post('requests')
  @Roles('SHIPPER', 'HUB_COORDINATOR')
  async createRequest(
    @Request() req: { user: { sub: string } },
    @Body()
    body: {
      type: string;
      amount: number;
      orderIds?: string[];
      bankAccountInfo?: string;
      remarks?: string;
    },
  ) {
    return await this.walletsService.createRequest(req.user.sub, body);
  }

  @Patch('requests/:id/approve')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  async approveRequest(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
    @Body() body: { status: string; remarks?: string },
  ) {
    return await this.walletsService.approveRequest(id, req.user.sub, body);
  }
}
