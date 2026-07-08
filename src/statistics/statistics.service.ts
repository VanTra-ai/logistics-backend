import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}

  // Cảnh báo SLA (Đơn hàng tồn đọng quá hạn 24h)
  async getSlaAlerts(hubId?: string): Promise<any> {
    const qb = this.ordersRepository.createQueryBuilder('order');
    qb.leftJoinAndSelect('order.customer', 'customer');

    // Điều kiện chung: không ở trạng thái kết thúc
    qb.where('order.current_status NOT IN (:...statuses)', {
      statuses: ['FINISHED', 'CANCELLED', 'RETURNED_TO_SENDER'],
    });

    // Tính toán số giờ bị trễ trực tiếp trong SQL (Postgres: EXTRACT(EPOCH FROM NOW() - created_at) / 3600)
    // Và chỉ lấy những đơn vượt quá 24h
    qb.andWhere('EXTRACT(EPOCH FROM (NOW() - order.created_at)) / 3600 >= 24');

    if (hubId) {
      qb.andWhere('order.pickup_hub_id = :hubId', { hubId });
    }

    qb.orderBy('order.created_at', 'ASC');

    const delayedOrders = await qb.getMany();
    const now = new Date();

    return {
      total_alerts: delayedOrders.length,
      threshold: '24 hours',
      delayed_orders: delayedOrders.map((order) => {
        const createdAtTime = new Date(order.created_at).getTime();
        const slaDeadlineTime = createdAtTime + 24 * 60 * 60 * 1000;
        const slaDeadline = new Date(slaDeadlineTime).toISOString();
        const hoursDelayed = Math.floor(
          (now.getTime() - createdAtTime) / (1000 * 60 * 60),
        );

        return {
          order_id: order.id,
          tracking_number: order.tracking_number,
          status: order.current_status,
          created_at: order.created_at,
          sla_deadline: slaDeadline,
          customer_name: order.customer?.full_name || 'N/A',
          hours_delayed: hoursDelayed,
          is_delayed: true, // Đã lọc ở QueryBuilder nên chắc chắn trễ
        };
      }),
    };
  }
}
