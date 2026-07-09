import { Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull, Not, In } from 'typeorm';
import { RouteOptimizationService } from './route-optimization.service';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
import { Shipment } from '../shipments/shipment.entity';
import { LocationsService } from '../locations/locations.service';

export class ConfirmDispatchDto {
  virtualShipments!: {
    shipperId: string;
    orders: {
      id: string;
      delivery_sequence: number;
    }[];
  }[];
}

@Injectable()
export class TmsService {
  private readonly logger = new Logger(TmsService.name);

  constructor(
    private dataSource: DataSource,
    private routeOptimizationService: RouteOptimizationService,
    private locationsService: LocationsService,
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
    // Khong startTransaction vi day la virtual dispatch

    const virtualShipments: any[] = [];

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
        .andWhere('user.is_online = true')
        .andWhere("user.last_heartbeat >= NOW() - INTERVAL '10 minutes'")
        .andWhere('shipment.id IS NULL')
        .getMany();

      if (availableShippers.length === 0) {
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
          const optimizedOrders =
            this.routeOptimizationService.optimizeOrderList(
              assignedOrdersToShipper,
              shipper.current_latitude!,
              shipper.current_longitude!,
            );

          virtualShipments.push({
            shipperId: shipper.id,
            shipperName: shipper.full_name,
            orders: optimizedOrders.map((o) => ({
              id: o.id,
              tracking_number: o.tracking_number,
              delivery_sequence: o.delivery_sequence,
              latitude: o.latitude,
              longitude: o.longitude,
              customer_name: o.receiver_name,
              recipient_address: o.receiver_address,
            })),
          });
        }
      }
    } catch (error) {
      this.logger.error('Error in autoDispatch', error);
      throw error;
    } finally {
      await queryRunner.release();
    }

    return {
      message: 'Gợi ý điều phối ảo thành công',
      virtualShipments,
    };
  }

  async confirmDispatch(data: ConfirmDispatchDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { virtualShipments } = data;
      let dispatchedShipments = 0;

      for (const vs of virtualShipments) {
        const shipper = await queryRunner.manager.findOne(User, {
          where: { id: vs.shipperId },
        });
        if (!shipper) continue;

        const shipment = queryRunner.manager.create(Shipment, {
          shipper: shipper,
          vehicle_type: 'BIKE',
          capacity_weight: 50,
          status: 'IN_TRANSIT',
        });
        const savedShipment = await queryRunner.manager.save(shipment);

        const orderIds = vs.orders.map((o) => o.id);
        const orders = await queryRunner.manager.findBy(Order, {
          id: In(orderIds),
        });

        for (const order of orders) {
          order.shipment = savedShipment;
          order.shipper = shipper;
          order.current_status = 'DELIVERING';
          const vo = vs.orders.find(
            (o: { id: string; delivery_sequence: number }) => o.id === order.id,
          );
          if (vo) {
            order.delivery_sequence = vo.delivery_sequence;
          }
          await this.locationsService.removeOrderFromLocation(
            order,
            queryRunner.manager,
          );
        }

        await queryRunner.manager.save(Order, orders);
        dispatchedShipments++;
      }

      await queryRunner.commitTransaction();
      return {
        message: 'Xác nhận điều phối thành công',
        dispatchedShipments,
      };
    } catch (error) {
      this.logger.error('Error in confirmDispatch', error);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
