import { Controller, Get, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { TrackingsService } from '../trackings/trackings.service';

@Controller('tracking') // Đường dẫn sẽ là /tracking
export class OrdersPublicController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly trackingsService: TrackingsService,
  ) {}

  private maskName(name: string): string {
    if (!name) return '';
    const parts = name.split(' ');
    return parts
      .map((p) => (p.length > 1 ? p[0] + '*'.repeat(p.length - 1) : p))
      .join(' ');
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 6) return '***';
    return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
  }

  @Get(':trackingNumber') // Endpoint: /tracking/:trackingNumber
  async getByTrackingNumber(@Param('trackingNumber') tn: string) {
    const order = await this.ordersService.findByTrackingNumber(tn);
    const history = await this.trackingsService.findByOrderId(order.id);

    const safeOrder = {
      id: order.id,
      tracking_number: order.tracking_number,
      current_status: order.current_status,
      sender_name: this.maskName(order.sender_name),
      sender_phone: this.maskPhone(order.sender_phone),
      receiver_name: this.maskName(order.receiver_name),
      receiver_phone: this.maskPhone(order.receiver_phone),
      weight: order.weight,
      created_at: order.created_at,
    };

    return {
      message: 'Tra cứu thành công!',
      data: { order: safeOrder, history },
    };
  }
}
