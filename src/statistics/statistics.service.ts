import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Order } from '../orders/order.entity';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}

  // Cảnh báo SLA (Đơn hàng tồn đọng quá hạn 24h)
  async getSlaAlerts(): Promise<any> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const delayedOrders = await this.ordersRepository.find({
      where: [
        { current_status: 'PENDING', created_at: LessThan(twentyFourHoursAgo) },
        { current_status: 'AT_HUB', created_at: LessThan(twentyFourHoursAgo) },
      ],
      relations: { customer: true },
      order: { created_at: 'ASC' },
    });

    return {
      total_alerts: delayedOrders.length,
      threshold: '24 hours',
      delayed_orders: delayedOrders.map((order) => ({
        order_id: order.id,
        status: order.current_status,
        created_at: order.created_at,
        customer_name: order.customer?.full_name || 'N/A',
        hours_delayed: Math.floor(
          (new Date().getTime() - new Date(order.created_at).getTime()) /
            (1000 * 60 * 60),
        ),
      })),
    };
  }
}
