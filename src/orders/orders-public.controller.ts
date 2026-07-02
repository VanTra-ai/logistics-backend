import { Controller, Get, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { TrackingsService } from '../trackings/trackings.service';

@Controller('tracking') // Đường dẫn sẽ là /tracking
export class OrdersPublicController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly trackingsService: TrackingsService,
  ) {}

  @Get(':trackingNumber') // Endpoint: /tracking/:trackingNumber
  async getByTrackingNumber(@Param('trackingNumber') tn: string) {
    const order = await this.ordersService.findByTrackingNumber(tn);
    const history = await this.trackingsService.findByOrderId(order.id);
    return { message: 'Tra cứu thành công!', data: { order, history } };
  }
}
