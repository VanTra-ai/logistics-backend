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
  async findMyWallet(@Request() req: { user: { userId: string } }) {
    return await this.walletsService.findMyWallet(req.user.userId);
  }

  @Get('me/stats')
  @Roles('SHIPPER')
  async getMyStats(
    @Request() req: { user: { userId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.walletsService.getMyStats(
      req.user.userId,
      startDate,
      endDate,
    );
  }

  @Get('me/transactions')
  @Roles('SHIPPER')
  async getMyWalletTransactions(
    @Request() req: { user: { userId: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    const wallet = await this.walletsService.findMyWallet(req.user.userId);
    return await this.walletsService.getWalletTransactions(
      wallet.id,
      pageNum,
      limitNum,
    );
  }

  @Get(':id/transactions')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  async getWalletTransactions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    return await this.walletsService.getWalletTransactions(
      id,
      pageNum,
      limitNum,
    );
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
    @Request() req: { user: { userId: string } },
    @Body()
    body: {
      type: string;
      amount: number;
      orderIds?: string[];
      bankAccountInfo?: string;
      remarks?: string;
    },
  ) {
    return await this.walletsService.createRequest(req.user.userId, body);
  }

  @Patch('requests/:id/approve')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  async processRequest(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Body() body: { status: string; remarks?: string },
  ) {
    return await this.walletsService.approveRequest(id, req.user.userId, body);
  }

  @Post('shippers/:shipperId/remit')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  async remitAllShipperCod(@Param('shipperId') shipperId: string) {
    return await this.walletsService.remitAllShipperCod(shipperId);
  }
}
