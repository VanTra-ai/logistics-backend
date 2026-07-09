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

  async create(createIncidentDto: CreateIncidentDto, proof_image_url?: string) {
    const { orderId, shipperId, reason, description } = createIncidentDto;

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    let shipper: User | null = null;
    if (shipperId) {
      const foundShipper = await this.userRepository.findOne({
        where: { id: shipperId },
      });
      if (!foundShipper) {
        throw new NotFoundException(`Shipper with ID ${shipperId} not found`);
      }
      shipper = foundShipper;
    }

    // Update order status to FAILED
    order.current_status = 'FAILED';
    await this.orderRepository.save(order);

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

  async findAll(page: number = 1, limit: number = 10, type?: string) {
    const query = this.incidentRepository
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.order', 'order')
      .leftJoinAndSelect('incident.shipper', 'shipper')
      .leftJoinAndSelect('incident.resolvedBy', 'resolvedBy')
      .orderBy('incident.created_at', 'DESC');

    if (type) {
      query.andWhere('incident.incident_type = :type', { type });
    }

    const [items, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems,
        itemCount: items.length,
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
          },
        },
      });

      if (!incident) {
        throw new NotFoundException(`Incident with ID ${id} not found`);
      }

      const resolvedBy = await queryRunner.manager.findOne(User, {
        where: { id: resolveDto.resolvedById },
      });

      if (!resolvedBy) {
        throw new NotFoundException(
          `User with ID ${resolveDto.resolvedById} not found`,
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
        userId: resolvedBy.id,
        newStatus: order.current_status,
        note: eventStatusNote,
        manager: queryRunner.manager,
      });

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
