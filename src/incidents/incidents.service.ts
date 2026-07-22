import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OrderIncident } from './incident.entity';
import { Order } from '../orders/order.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from '../users/user.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ResolveIncidentDto, ResolveAction } from './dto/resolve-incident.dto';
import { Shipment } from '../shipments/shipment.entity';
import { DeliveryAttempt } from '../shipments/delivery-attempt.entity';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(OrderIncident)
    private readonly incidentRepository: Repository<OrderIncident>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    createIncidentDto: CreateIncidentDto,
    currentUserId?: string,
    proof_image_url?: string,
  ) {
    const { orderId, shipperId, reason, description } = createIncidentDto;

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { shipper: true, shipment: { shipper: true } },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    let shipper: User | null = null;
    const targetShipperId = shipperId || currentUserId;
    if (targetShipperId) {
      const foundShipper = await this.userRepository.findOne({
        where: { id: targetShipperId },
      });
      if (
        foundShipper &&
        (foundShipper.role === 'SHIPPER' ||
          foundShipper.role === 'HUB_COORDINATOR')
      ) {
        shipper = foundShipper;
      }
    }

    // Fallback to order's assigned shipper or shipment shipper if still null
    if (!shipper) {
      shipper = order.shipper || order.shipment?.shipper || null;
    }

    // Update order status to FAILED
    order.current_status = 'FAILED';
    await this.orderRepository.save(order);

    // Update DeliveryAttempt to FAILED
    if (order.shipment) {
      const attempt = await this.dataSource.manager.findOne(DeliveryAttempt, {
        where: { order: { id: order.id }, shipment: { id: order.shipment.id } },
      });
      if (attempt) {
        attempt.status = 'FAILED';
        attempt.failure_reason = reason;
        attempt.proof_image_url = proof_image_url as string;
        await this.dataSource.manager.save(DeliveryAttempt, attempt);
      }
    }

    await this.eventEmitter.emitAsync('order.status.changed', {
      order,
      operatorId: shipper?.id,
      status: 'FAILED',
      note: `Báo cáo sự cố: ${reason}. Mô tả: ${description}`,
    });

    const incident = this.incidentRepository.create({
      order,
      shipper,
      reason,
      description,
      proof_image_url,
      status: 'PENDING',
    });

    return this.incidentRepository.save(incident);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    type?: string,
    hubId?: string,
    search?: string,
    currentUser?: { userId: string; role?: string; hubId?: string },
  ) {
    const query = this.incidentRepository
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.order', 'order')
      .leftJoinAndSelect('order.pickup_hub', 'pickup_hub')
      .leftJoinAndSelect('order.shipper', 'orderShipper')
      .leftJoinAndSelect('order.shipment', 'shipment')
      .leftJoinAndSelect('shipment.shipper', 'shipmentShipper')
      .leftJoinAndSelect('incident.shipper', 'shipper')
      .leftJoinAndSelect('incident.resolvedBy', 'resolvedBy')
      .orderBy('incident.created_at', 'DESC');

    if (type) {
      query.andWhere('incident.incident_type = :type', { type });
    }

    const activeHubId =
      currentUser?.role === 'HUB_COORDINATOR' && currentUser?.hubId
        ? currentUser.hubId
        : hubId;

    if (activeHubId && activeHubId !== 'ALL') {
      query.andWhere('pickup_hub.id = :activeHubId', { activeHubId });
    }

    if (search) {
      const searchPattern = `%${search}%`;
      query.andWhere(
        '(order.tracking_number ILIKE :search OR shipper.full_name ILIKE :search OR shipmentShipper.full_name ILIKE :search OR orderShipper.full_name ILIKE :search OR incident.reason ILIKE :search)',
        { search: searchPattern },
      );
    }

    const [items, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Ensure shipper fallback if incident.shipper is null in legacy records
    const mappedItems = items.map((inc) => {
      const effectiveShipper =
        inc.shipper ||
        inc.order?.shipper ||
        inc.order?.shipment?.shipper ||
        null;
      return {
        ...inc,
        shipper: effectiveShipper,
      };
    });

    return {
      data: mappedItems,
      meta: {
        totalItems,
        itemCount: mappedItems.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
      },
    };
  }

  async resolve(
    id: string,
    resolveDto: ResolveIncidentDto,
    currentUser: { userId: string; role?: string; hubId?: string },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const incident = await queryRunner.manager.findOne(OrderIncident, {
        where: { id },
        relations: {
          order: {
            pickup_hub: true,
            shipment: true,
          },
        },
      });

      if (!incident) {
        throw new NotFoundException(`Incident with ID ${id} not found`);
      }

      const resolvedBy = await queryRunner.manager.findOne(User, {
        where: { id: currentUser.userId },
      });

      if (!resolvedBy) {
        throw new NotFoundException(
          `User with ID ${currentUser.userId} not found`,
        );
      }

      const order = incident.order;

      if (
        currentUser?.role === 'HUB_COORDINATOR' &&
        order.pickup_hub?.id !== currentUser?.hubId
      ) {
        throw new ForbiddenException(
          'Bạn chỉ có quyền duyệt sự cố cho đơn hàng thuộc bưu cục của mình!',
        );
      }

      let oldShipmentId: string | null = null;
      if (
        resolveDto.action === ResolveAction.REDELIVERY ||
        resolveDto.action === ResolveAction.RETURN ||
        resolveDto.action === ResolveAction.COMPENSATION
      ) {
        if (order.shipment) {
          oldShipmentId = order.shipment.id;
          order.shipment = null as any;
        }
      }

      // The action can be REDELIVERY (set Order current_status to AT_HUB), RETURN (set to RETURN_TO_SENDER), COMPENSATION (set to DAMAGED_DESTROYED). Update Incident status to RESOLVED_REDELIVERY etc.
      if (resolveDto.action === ResolveAction.REDELIVERY) {
        order.current_status = 'AT_HUB';
        incident.status = 'RESOLVED_REDELIVERY';
      } else if (resolveDto.action === ResolveAction.RETURN) {
        order.current_status = 'RETURN_TO_SENDER';
        incident.status = 'RESOLVED_RETURN';
      } else if (resolveDto.action === ResolveAction.COMPENSATION) {
        order.current_status = 'DAMAGED_DESTROYED';
        incident.status = 'RESOLVED_COMPENSATION';
      } else if (resolveDto.action === ResolveAction.REJECT) {
        order.current_status = 'IN_TRANSIT';
        incident.status = 'REJECTED';
      }

      incident.resolvedBy = resolvedBy;
      if (resolveDto.resolution_notes) {
        incident.resolution_notes = resolveDto.resolution_notes;
      }

      await queryRunner.manager.save(order);
      const updatedIncident = await queryRunner.manager.save(incident);

      // Emit event using the transaction manager so the tracking record is saved within the transaction
      let eventStatusNote = '';
      if (resolveDto.action === ResolveAction.REDELIVERY) {
        eventStatusNote = `Sự cố đã được duyệt giao lại. Cập nhật thành: Lưu kho. ${resolveDto.resolution_notes || ''}`;
      } else if (resolveDto.action === ResolveAction.RETURN) {
        eventStatusNote = `Sự cố hoàn hàng đã duyệt. ${resolveDto.resolution_notes || ''}`;
      } else if (resolveDto.action === ResolveAction.COMPENSATION) {
        eventStatusNote = `Sự cố đền bù đã duyệt. ${resolveDto.resolution_notes || ''}`;
      } else if (resolveDto.action === ResolveAction.REJECT) {
        eventStatusNote = `Báo cáo sự cố bị từ chối. Đơn hàng tiếp tục hành trình. ${resolveDto.resolution_notes || ''}`;
      }

      this.eventEmitter.emit('order.status.changed', {
        order,
        operatorId: resolvedBy.id,
        status: order.current_status,
        note: eventStatusNote,
        manager: queryRunner.manager,
      });

      // Nếu đơn hàng bị gỡ khỏi chuyến xe, kiểm tra xem chuyến xe đó đã hoàn thành chưa
      if (oldShipmentId) {
        const remainingOrders = await queryRunner.manager.find(Order, {
          where: { shipment: { id: oldShipmentId } },
        });

        const allCompleted = remainingOrders.every(
          (o) =>
            o.current_status === 'FINISHED' ||
            o.current_status === 'RETURNING' ||
            o.current_status === 'RETURNED' ||
            o.current_status === 'CANCELLED',
        );

        if (remainingOrders.length === 0 || allCompleted) {
          await queryRunner.manager.update(
            Shipment,
            { id: oldShipmentId },
            { status: 'COMPLETED' },
          );
        }
      }

      await queryRunner.commitTransaction();
      return updatedIncident;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
