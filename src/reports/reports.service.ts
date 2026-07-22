import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Order } from '../orders/order.entity';
import { Location } from '../locations/location.entity';
import { Shipment } from '../shipments/shipment.entity';
import { AuditLog } from '../audit-logs/audit-log.entity';
import { DailyStats } from './daily-stat.entity';
import { Transaction } from '../wallets/transaction.entity';
import { TrackingHistory } from '../trackings/tracking.entity';
import { DeliveryAttempt } from '../shipments/delivery-attempt.entity';

interface HubPerformanceItem {
  name: string;
  scan_in: number;
  scan_out: number;
  backlog: number;
  full_locations: number;
  total_locations: number;
}

interface ShipperRawRow {
  id: string;
  shipperCode?: string;
  name?: string;
  hubName?: string;
  total_orders?: string | number;
  successful_orders?: string | number;
  revenue?: string | number;
}

interface ScanRawRow {
  hubName: string;
  scan_in?: string | number;
  scan_out?: string | number;
}

interface BacklogRawRow {
  hubName: string;
  backlog?: string | number;
}

interface CapacityRawRow {
  hubName: string;
  full_locations?: string | number;
  total_locations?: string | number;
}

interface PnlByHubRawRow {
  date: string;
  hubName: string;
  revenue?: string | number;
  material_costs?: string | number;
}

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
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(TrackingHistory)
    private readonly trackingRepo: Repository<TrackingHistory>,
    @InjectRepository(DeliveryAttempt)
    private readonly deliveryAttemptRepo: Repository<DeliveryAttempt>,
  ) {}

  async getPnlTimeSeries(startDate?: string, endDate?: string) {
    const qb = this.dailyStatsRepo.createQueryBuilder('stats');

    if (startDate) {
      qb.andWhere('stats.date >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('stats.date <= :endDate', { endDate });
    }

    qb.orderBy('stats.date', 'ASC');
    const data = await qb.getMany();

    return data.map((d) => ({
      date: d.date,
      revenue: Number(d.total_revenue),
      costs: Number(d.total_costs),
      profit: Number(d.total_revenue) - Number(d.total_costs),
    }));
  }

  async getShipperLeaderboard(
    startDate?: string,
    endDate?: string,
    page = 1,
    limit = 10,
  ) {
    const qb = this.deliveryAttemptRepo
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.shipper', 'shipper')
      .leftJoin('shipper.hub', 'hub')
      .leftJoin('attempt.order', 'order')
      .where('shipper.id IS NOT NULL');

    if (startDate) {
      qb.andWhere('attempt.updated_at >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('attempt.updated_at <= :endDate', { endDate });
    }

    const countQb = this.deliveryAttemptRepo
      .createQueryBuilder('attempt')
      .leftJoin('attempt.shipper', 'shipper')
      .where('shipper.id IS NOT NULL');
    if (startDate)
      countQb.andWhere('attempt.updated_at >= :startDate', { startDate });
    if (endDate)
      countQb.andWhere('attempt.updated_at <= :endDate', { endDate });

    const totalCountRaw = await countQb
      .select('COUNT(DISTINCT shipper.id)', 'total')
      .getRawOne<{ total?: string | number }>();
    const totalItems = Number(totalCountRaw?.total || 0);

    const rawData = await qb
      .select('shipper.id', 'id')
      .addSelect('shipper.employee_code', 'shipperCode')
      .addSelect('shipper.full_name', 'name')
      .addSelect('hub.name', 'hubName')
      .addSelect('COUNT(attempt.id)', 'total_orders')
      .addSelect(
        "SUM(CASE WHEN attempt.status = 'FINISHED' THEN 1 ELSE 0 END)",
        'successful_orders',
      )
      .addSelect(
        "SUM(CASE WHEN attempt.status = 'FINISHED' THEN order.shipping_fee ELSE 0 END)",
        'revenue',
      )
      .groupBy('shipper.id')
      .addGroupBy('shipper.employee_code')
      .addGroupBy('shipper.full_name')
      .addGroupBy('hub.name')
      .orderBy('revenue', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<ShipperRawRow>();

    const data = rawData.map((d, index) => {
      const totalOrders = Number(d.total_orders || 0);
      const successfulOrders = Number(d.successful_orders || 0);
      const rank = (page - 1) * limit + index + 1;
      return {
        rank,
        id: d.id,
        shipperCode: d.shipperCode || 'N/A',
        name: d.name || 'Không xác định',
        hubName: d.hubName || 'Chưa gán bưu cục',
        total_orders: totalOrders,
        successful_orders: successfulOrders,
        success_rate:
          totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0,
        revenue: Number(d.revenue || 0),
      };
    });

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit) || 1,
        currentPage: page,
      },
    };
  }

  async getHubPerformance(startDate?: string, endDate?: string) {
    // 1. Scan-in (AT_HUB) and Scan-out (DELIVERING/IN_TRANSIT) from TrackingHistory - DISTINCT orders
    const thQb = this.trackingRepo
      .createQueryBuilder('th')
      .leftJoin('th.order', 'order')
      .leftJoin('order.pickup_hub', 'hub')
      .where('hub.id IS NOT NULL');

    if (startDate) {
      thQb.andWhere('th.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      thQb.andWhere('th.created_at <= :endDate', { endDate });
    }

    const scanData = await thQb
      .select('hub.name', 'hubName')
      .addSelect(
        "COUNT(DISTINCT CASE WHEN th.status = 'AT_HUB' THEN order.id END)",
        'scan_in',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN th.status IN ('DELIVERING', 'IN_TRANSIT') THEN order.id END)",
        'scan_out',
      )
      .groupBy('hub.name')
      .getRawMany<ScanRawRow>();

    // 2. Backlog (Current Inventory AT_HUB or RETURN_TO_SENDER)
    const backlogData = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoin('order.pickup_hub', 'hub')
      .where('hub.id IS NOT NULL')
      .andWhere("order.current_status IN ('AT_HUB', 'RETURN_TO_SENDER')")
      .select('hub.name', 'hubName')
      .addSelect('COUNT(DISTINCT order.id)', 'backlog')
      .groupBy('hub.name')
      .getRawMany<BacklogRawRow>();

    // 3. Capacity: from Location table
    const capacityData = await this.locationRepo
      .createQueryBuilder('loc')
      .leftJoin('loc.hub', 'hub')
      .where('hub.id IS NOT NULL')
      .select('hub.name', 'hubName')
      .addSelect(
        "SUM(CASE WHEN loc.status = 'FULL' THEN 1 ELSE 0 END)",
        'full_locations',
      )
      .addSelect('COUNT(loc.id)', 'total_locations')
      .groupBy('hub.name')
      .getRawMany<CapacityRawRow>();

    // Merge data by hub name
    const hubs: Record<string, HubPerformanceItem> = {};

    scanData.forEach((d) => {
      if (!hubs[d.hubName]) {
        hubs[d.hubName] = {
          name: d.hubName,
          scan_in: 0,
          scan_out: 0,
          backlog: 0,
          full_locations: 0,
          total_locations: 0,
        };
      }
      hubs[d.hubName].scan_in = Number(d.scan_in || 0);
      hubs[d.hubName].scan_out = Number(d.scan_out || 0);
    });

    backlogData.forEach((d) => {
      if (!hubs[d.hubName]) {
        hubs[d.hubName] = {
          name: d.hubName,
          scan_in: 0,
          scan_out: 0,
          backlog: 0,
          full_locations: 0,
          total_locations: 0,
        };
      }
      hubs[d.hubName].backlog = Number(d.backlog || 0);
    });

    capacityData.forEach((d) => {
      if (!hubs[d.hubName]) {
        hubs[d.hubName] = {
          name: d.hubName,
          scan_in: 0,
          scan_out: 0,
          backlog: 0,
          full_locations: 0,
          total_locations: 0,
        };
      }
      hubs[d.hubName].full_locations = Number(d.full_locations || 0);
      hubs[d.hubName].total_locations = Number(d.total_locations || 0);
    });

    return Object.values(hubs).map((h) => ({
      name: h.name,
      scan_in: h.scan_in,
      scan_out: h.scan_out,
      backlog: h.backlog,
      throughput: h.scan_in + h.scan_out,
      capacity_rate:
        h.total_locations > 0
          ? (h.full_locations / h.total_locations) * 100
          : 0,
    }));
  }

  async getPnlByHub(startDate?: string, endDate?: string) {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoin('order.pickup_hub', 'hub')
      .where("order.current_status = 'FINISHED'");

    if (startDate) {
      qb.andWhere('order.updated_at >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('order.updated_at <= :endDate', { endDate });
    }

    const rawData = await qb
      .select("TO_CHAR(order.updated_at, 'YYYY-MM-DD')", 'date')
      .addSelect("COALESCE(hub.name, 'Bưu cục chưa xác định')", 'hubName')
      .addSelect('SUM(order.shipping_fee)', 'revenue')
      .addSelect('SUM(order.material_fee)', 'material_costs')
      .groupBy("TO_CHAR(order.updated_at, 'YYYY-MM-DD')")
      .addGroupBy('hub.name')
      .orderBy('date', 'ASC')
      .getRawMany<PnlByHubRawRow>();

    return rawData.map((d) => ({
      date: d.date,
      hubName: d.hubName,
      revenue: Number(d.revenue || 0),
      material_costs: Number(d.material_costs || 0),
      profit: Number(d.revenue || 0) - Number(d.material_costs || 0),
    }));
  }

  // Legacy endpoints for compatibility, or you can update controller to use new ones.
  async getPnl(startDate?: string, endDate?: string) {
    return this.getPnlTimeSeries(startDate, endDate);
  }
  async getCodReconciliation() {
    return this.orderRepo.find({
      where: { current_status: 'FINISHED', cod_status: 'PENDING_REMITTANCE' },
      relations: { shipper: true },
    });
  }
  async getHeatmap() {
    return this.getHubPerformance();
  }
  getInventoryAging() {
    return Promise.resolve([]);
  }
  async getShipperKpi() {
    return this.getShipperLeaderboard();
  }
  async getWarehouseKpi() {
    return this.getHubPerformance();
  }

  @Cron('59 23 * * *')
  async snapshotDailyStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const ordersCount = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.updated_at >= :start AND order.updated_at <= :end', {
        start: today,
        end: endOfToday,
      })
      .andWhere("order.current_status = 'FINISHED'")
      .getCount();

    // Revenue = SUM(shipping_fee)
    const revObj = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.updated_at >= :start AND order.updated_at <= :end', {
        start: today,
        end: endOfToday,
      })
      .andWhere("order.current_status = 'FINISHED'")
      .select('SUM(order.shipping_fee)', 'revenue')
      .getRawOne<{ revenue?: string | number }>();

    // Costs = SUM(material_fee) + SUM(shipper_payout COMMISSION_EARNED)
    const costObj1 = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.updated_at >= :start AND order.updated_at <= :end', {
        start: today,
        end: endOfToday,
      })
      .andWhere("order.current_status = 'FINISHED'")
      .select('SUM(order.material_fee)', 'material_costs')
      .getRawOne<{ material_costs?: string | number }>();

    const costObj2 = await this.transactionRepo
      .createQueryBuilder('tx')
      .where('tx.created_at >= :start AND tx.created_at <= :end', {
        start: today,
        end: endOfToday,
      })
      .andWhere('tx.type = :type', { type: 'COMMISSION_EARNED' })
      .select('SUM(tx.amount)', 'shipper_payout')
      .getRawOne<{ shipper_payout?: string | number }>();

    const revenue = Number(revObj?.revenue || 0);
    const costs =
      Number(costObj1?.material_costs || 0) +
      Number(costObj2?.shipper_payout || 0);

    // Upsert logic for today
    let stat = await this.dailyStatsRepo.findOne({ where: { date: today } });
    if (!stat) {
      stat = new DailyStats();
      stat.date = today;
    }
    stat.total_orders = ordersCount;
    stat.total_revenue = revenue;
    stat.total_costs = costs;

    await this.dailyStatsRepo.save(stat);
    console.log('Saved daily stats snapshot');
  }
}
