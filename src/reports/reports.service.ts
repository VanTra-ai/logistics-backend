import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Order } from '../orders/order.entity';
import { Location } from '../locations/location.entity';
import { Shipment } from '../shipments/shipment.entity';
import { AuditLog } from '../audit-logs/audit-log.entity';
import { DailyStats } from './daily-stat.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(DailyStats)
    private readonly dailyStatsRepo: Repository<DailyStats>,
  ) {}

  async getPnl(startDate?: string, endDate?: string) {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .select('SUM(order.shipping_fee)', 'sum_shipping')
      .addSelect('SUM(order.material_fee)', 'sum_material');

    if (startDate) {
      qb.andWhere('order.created_at >= :startDate', { startDate });
    } else {
      // Default to last 30 days if not provided
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      qb.andWhere('order.created_at >= :startDate', {
        startDate: thirtyDaysAgo,
      });
    }

    if (endDate) {
      qb.andWhere('order.created_at <= :endDate', { endDate });
    }

    const { sum_shipping, sum_material } = (await qb.getRawOne()) || {};

    const total_revenue = parseFloat(String(sum_shipping ?? '0'));
    const total_costs = parseFloat(String(sum_material ?? '0'));
    return {
      revenue: total_revenue,
      costs: total_costs,
      pnl: total_revenue - total_costs,
    };
  }

  async getCodReconciliation() {
    return this.orderRepo.find({
      where: {
        current_status: 'FINISHED',
        cod_status: 'PENDING_REMITTANCE',
      },
    });
  }

  async getHeatmap() {
    return this.locationRepo
      .createQueryBuilder('loc')
      .leftJoin('loc.orders', 'order')
      .select('loc.zone', 'zone')
      .addSelect('loc.aisle', 'aisle')
      .addSelect('COUNT(order.id)', 'order_count')
      .addSelect('SUM(loc.max_capacity)', 'total_capacity')
      .groupBy('loc.zone')
      .addGroupBy('loc.aisle')
      .getRawMany();
  }

  async getInventoryAging() {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    return this.orderRepo
      .createQueryBuilder('order')
      .where('order.current_status = :status', { status: 'AT_HUB' })
      .andWhere('order.updated_at < :date', { date: threeDaysAgo })
      .getMany();
  }

  async getShipperKpi() {
    // Shipments grouped by shipperId
    return this.shipmentRepo
      .createQueryBuilder('shipment')
      .leftJoin('shipment.orders', 'order')
      .leftJoin('shipment.shipper', 'shipper')
      .select('shipper.id', 'shipperId')
      .addSelect('COUNT(DISTINCT shipment.id)', 'shipment_count')
      .addSelect('SUM(shipment.total_distance)', 'total_distance')
      .addSelect(
        "SUM(CASE WHEN order.current_status = 'FINISHED' THEN 1 ELSE 0 END)",
        'successful_orders',
      )
      .addSelect('COUNT(order.id)', 'total_orders')
      .groupBy('shipper.id')
      .getRawMany();
  }

  async getWarehouseKpi() {
    return this.auditLogRepo
      .createQueryBuilder('audit')
      .select('audit.userId', 'userId')
      .addSelect('audit.subAction', 'subAction')
      .addSelect('COUNT(audit.id)', 'action_count')
      .where('audit.userId IS NOT NULL')
      .groupBy('audit.userId')
      .addGroupBy('audit.subAction')
      .getRawMany();
  }

  @Cron('59 23 * * *')
  async snapshotDailyStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const ordersCount = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.created_at >= :start AND order.created_at <= :end', {
        start: today,
        end: endOfToday,
      })
      .getCount();

    const pnl = await this.getPnl();

    const stat = new DailyStats();
    stat.date = today;
    stat.total_orders = ordersCount;
    stat.total_revenue = pnl.revenue;
    stat.total_costs = pnl.costs;

    await this.dailyStatsRepo.save(stat);
    console.log('Saved daily stats snapshot');
  }
}
