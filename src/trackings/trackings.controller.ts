import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { TrackingsService } from './trackings.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('trackings')
@UseGuards(AuthGuard('jwt'))
export class TrackingsController {
  constructor(private readonly trackingsService: TrackingsService) {}

  @Get(':orderId')
  async getTrackingByOrder(@Param('orderId') orderId: string) {
    const history = await this.trackingsService.findByOrderId(orderId);
    return {
      message: 'Lấy lịch sử đơn hàng thành công!',
      data: history,
    };
  }
}
