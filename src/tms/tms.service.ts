import { Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull, Not } from 'typeorm';
import { RouteOptimizationService } from './route-optimization.service';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
import { Shipment } from '../shipments/shipment.entity';

@Injectable()
export class TmsService {
  private readonly logger = new Logger(TmsService.name);

  constructor(
    private dataSource: DataSource,
    private routeOptimizationService: RouteOptimizationService,
  ) {}

  // Helper distance function
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

  async autoDispatch() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const newShipmentsIds: string[] = [];

    try {
      // 1. Find all shippers (role = SHIPPER) with current location
      // Filter out shippers currently IN_TRANSIT using LEFT JOIN to prevent N+1 query issue
      const availableShippers = await queryRunner.manager
        .createQueryBuilder(User, 'user')
        .leftJoin(
          Shipment,
          'shipment',
          "shipment.shipperId = user.id AND shipment.status = 'IN_TRANSIT'",
        )
        .where("user.role = 'SHIPPER'")
        .andWhere('user.current_latitude IS NOT NULL')
        .andWhere('user.current_longitude IS NOT NULL')
        .andWhere('shipment.id IS NULL')
        .getMany();

      if (availableShippers.length === 0) {
        await queryRunner.rollbackTransaction();
        return { message: 'Không có tài xế nào rảnh' };
      }

      // 2. Find all orders AT_HUB without shipment
      const pendingOrders = await queryRunner.manager.find(Order, {
        where: {
          current_status: 'AT_HUB',
          shipment: IsNull(),
          latitude: Not(IsNull()),
          longitude: Not(IsNull()),
        },
      });

      if (pendingOrders.length === 0) {
        await queryRunner.rollbackTransaction();
        return { message: 'Không có đơn hàng nào cần điều phối' };
      }

      // 3. Assign orders to shippers based on distance and capacity
      let unassignedOrders = [...pendingOrders];

      for (const shipper of availableShippers) {
        if (unassignedOrders.length === 0) break;

        const maxCapacity = 1000;
        let currentWeight = 0;
        const assignedOrdersToShipper: Order[] = [];
        const remainingForOthers: Order[] = [];

        while (unassignedOrders.length > 0) {
          let nearestIdx = -1;
          let minDistance = Infinity;

          for (let i = 0; i < unassignedOrders.length; i++) {
            const order = unassignedOrders[i];
            const dist = this.getDistance(
              shipper.current_latitude!,
              shipper.current_longitude!,
              order.latitude,
              order.longitude,
            );
            if (dist < minDistance) {
              minDistance = dist;
              nearestIdx = i;
            }
          }

          if (nearestIdx !== -1) {
            const orderToAssign = unassignedOrders[nearestIdx];
            unassignedOrders.splice(nearestIdx, 1);

            const orderWeight = Number(orderToAssign.weight) || 0;
            if (currentWeight + orderWeight <= maxCapacity) {
              assignedOrdersToShipper.push(orderToAssign);
              currentWeight += orderWeight;
            } else {
              remainingForOthers.push(orderToAssign);
            }
          }
        }

        unassignedOrders = remainingForOthers;

        if (assignedOrdersToShipper.length > 0) {
          const shipment = queryRunner.manager.create(Shipment, {
            shipper: shipper,
            capacity_weight: maxCapacity,
            status: 'IN_TRANSIT',
          });
          const savedShipment = await queryRunner.manager.save(shipment);

          assignedOrdersToShipper.forEach((order) => {
            order.shipment = savedShipment;
          });
          await queryRunner.manager.save(Order, assignedOrdersToShipper);

          newShipmentsIds.push(savedShipment.id);
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      this.logger.error('Error in autoDispatch transaction', error);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // 4. Call optimizeRoute for each shipment
    for (const shipmentId of newShipmentsIds) {
      await this.routeOptimizationService.optimizeRoute(shipmentId);
    }

    return {
      message: 'Điều phối tự động thành công',
      dispatchedShipments: newShipmentsIds.length,
    };
  }
}
