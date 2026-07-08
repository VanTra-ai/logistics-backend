import { Controller, Get, Post, Body } from '@nestjs/common';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  async findAll() {
    return this.walletsService.findAll();
  }

  @Post('remit-cod')
  async remitCod(@Body() body: { shipperId: string; amount: number }) {
    return this.walletsService.remitCod(body.shipperId, body.amount);
  }
}
