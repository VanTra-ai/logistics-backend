import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
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
    return this.walletsService.findAll();
  }

  @Get('me')
  @Roles('SHIPPER')
  async findMyWallet(@Request() req: { user: { sub: string } }) {
    return this.walletsService.findMyWallet(req.user.sub);
  }

  @Post('remit-cod')
  @Roles('ADMIN') // Assuming only admin or coordinator can remit cod on behalf of shipper? Or shipper remits themselves? The current implementation takes shipperId from body. Let's restrict it to ADMIN for now, or keep it open if it's meant for Shipper? The user didn't mention remit-cod, but it takes shipperId. Let's allow ADMIN.
  async remitCod(@Body() body: { shipperId: string; amount: number }) {
    return this.walletsService.remitCod(body.shipperId, body.amount);
  }
}
