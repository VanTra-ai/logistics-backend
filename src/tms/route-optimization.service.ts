import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from '../shipments/shipment.entity';
import { Order } from '../orders/order.entity';

@Injectable()
export class RouteOptimizationService {
  constructor(
    @InjectRepository(Shipment)
    private shipmentRepo: Repository<Shipment>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
  ) {}

  // Calculate distance between two lat/lon points using Haversine formula
  private getDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  // For Virtual Dispatch: Sorts a list of orders based on nearest neighbor
  optimizeOrderList(
    orders: Order[],
    startLat: number,
    startLon: number,
  ): Order[] {
    if (orders.length === 0) return [];

    const unvisited = [...orders];
    const optimized: Order[] = [];
    let sequence = 1;
    let currentLat = startLat;
    let currentLon = startLon;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const order = unvisited[i];
        if (order.latitude == null || order.longitude == null) continue;

        const distance = this.getDistance(
          currentLat,
          currentLon,
          order.latitude,
          order.longitude,
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestIdx = i;
        }
      }

      const nearestOrder = unvisited[nearestIdx];
      nearestOrder.delivery_sequence = sequence++;

      optimized.push(nearestOrder);
      currentLat = nearestOrder.latitude;
      currentLon = nearestOrder.longitude;
      unvisited.splice(nearestIdx, 1);
    }

    return optimized;
  }

  async optimizeRoute(shipmentId: string): Promise<void> {
    const shipment = await this.shipmentRepo.findOne({
      where: { id: shipmentId },
      relations: { orders: true, shipper: true },
    });

    if (!shipment || !shipment.orders || shipment.orders.length === 0) {
      return;
    }

    const ordersWithLoc = shipment.orders.filter(
      (o) => o.latitude != null && o.longitude != null,
    );
    if (ordersWithLoc.length === 0) return;

    let currentLat = shipment.shipper?.current_latitude;
    let currentLon = shipment.shipper?.current_longitude;

    if (currentLat == null || currentLon == null) {
      currentLat = ordersWithLoc[0].latitude;
      currentLon = ordersWithLoc[0].longitude;
    }

    const optimizedOrders = this.optimizeOrderList(
      ordersWithLoc,
      currentLat,
      currentLon,
    );

    // Save all optimized orders in one go to avoid N+1 queries
    if (optimizedOrders.length > 0) {
      await this.orderRepo.save(optimizedOrders);
    }
  }
}
