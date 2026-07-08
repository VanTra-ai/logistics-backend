import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Patch,
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
  @Roles('ADMIN')
  async findAll() {
    return await this.walletsService.findAll();
  }

  @Get('me')
  @Roles('SHIPPER')
  async findMyWallet(@Request() req: { user: { sub: string } }) {
    return await this.walletsService.findMyWallet(req.user.sub);
  }

  @Get('requests')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  async getRequests() {
    return await this.walletsService.getRequests();
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
