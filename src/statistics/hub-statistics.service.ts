import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Order } from '../orders/order.entity';
import { Location } from '../locations/location.entity';
import { Shipment } from '../shipments/shipment.entity';

@Injectable()
export class HubStatisticsService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Location)
    private readonly locationsRepository: Repository<Location>,
    @InjectRepository(Shipment)
    private readonly shipmentsRepository: Repository<Shipment>,
  ) {}

  async getOverview(hubId: string) {
    if (!hubId) throw new BadRequestException('hubId is required');

    // Orders counts
    const ordersAtHub = await this.ordersRepository.count({
      where: { pickup_hub: { id: hubId }, current_status: 'AT_HUB' },
    });

    const delivering = await this.ordersRepository
      .createQueryBuilder('order')
      .leftJoin('order.pickup_hub', 'pickup_hub')
      .where('order.current_status = :status', { status: 'DELIVERING' })
      .andWhere('pickup_hub.id = :hubId', { hubId })
      .getCount();

    const pending = await this.ordersRepository.count({
      where: { pickup_hub: { id: hubId }, current_status: 'PENDING' },
    });

    // Locations capacity
    const locationsRaw = await this.locationsRepository
      .createQueryBuilder('location')
      .leftJoin('location.hub', 'hub')
      .select('location.status', 'status')
      .addSelect('COUNT(location.id)', 'count')
      .where('hub.id = :hubId', { hubId })
      .groupBy('location.status')
      .getRawMany();

    const locations = {
      empty_slots: 0,
      occupied_slots: 0,
      full_slots: 0,
      total: 0,
    };
    locationsRaw.forEach((row: { count: string; status: string }) => {
      const count = parseInt(row.count, 10);
      locations.total += count;
      if (row.status === 'EMPTY') locations.empty_slots = count;
      else if (row.status === 'OCCUPIED') locations.occupied_slots = count;
      else if (row.status === 'FULL') locations.full_slots = count;
    });

    // SLA overdue (> 24h)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const slaOverdue = await this.ordersRepository.count({
      where: {
        pickup_hub: { id: hubId },
        current_status: 'AT_HUB',
        updated_at: LessThan(twentyFourHoursAgo),
      },
    });

    return {
      total: ordersAtHub + pending + delivering,
      waiting_putaway: ordersAtHub,
      waiting_dispatch: pending,
      sla_overdue: slaOverdue,
      delivering,
      locations,
    };
  }

  async getShipmentMonitor(hubId: string) {
    if (!hubId) throw new BadRequestException('hubId is required');

    const inbound = await this.shipmentsRepository.find({
      where: {
        destination_hub: { id: hubId },
        status: 'IN_TRANSIT',
        vehicle_type: 'TRUCK',
      },
      relations: { shipper: true, origin_hub: true, destination_hub: true },
      order: { created_at: 'DESC' },
      take: 5,
    });

    const outbound = await this.shipmentsRepository.find({
      where: { origin_hub: { id: hubId }, status: 'PENDING' },
      relations: { shipper: true, origin_hub: true, destination_hub: true },
      order: { created_at: 'DESC' },
      take: 5,
    });

    return {
      inbound,
      outbound,
    };
  }
}
