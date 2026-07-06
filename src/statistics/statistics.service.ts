import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, In } from 'typeorm';
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
      where: {
        current_status: Not(
          In(['FINISHED', 'CANCELLED', 'RETURNED_TO_SENDER']),
        ),
        created_at: LessThan(twentyFourHoursAgo),
      },
      relations: { customer: true },
      order: { created_at: 'ASC' },
    });

    const now = new Date();

    return {
      total_alerts: delayedOrders.length,
      threshold: '24 hours',
      delayed_orders: delayedOrders.map((order) => {
        const createdAtTime = new Date(order.created_at).getTime();
        const slaDeadlineTime = createdAtTime + 24 * 60 * 60 * 1000;
        const slaDeadline = new Date(slaDeadlineTime).toISOString();
        const hoursDelayed = Math.max(
          0,
          Math.floor((now.getTime() - createdAtTime) / (1000 * 60 * 60)),
        );

        return {
          order_id: order.id,
          tracking_number: order.tracking_number,
          status: order.current_status,
          created_at: order.created_at,
          sla_deadline: slaDeadline,
          customer_name: order.customer?.full_name || 'N/A',
          hours_delayed: hoursDelayed,
          is_delayed: now.getTime() > slaDeadlineTime,
        };
      }),
    };
  }
}
