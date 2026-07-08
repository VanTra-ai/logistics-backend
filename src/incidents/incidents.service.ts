import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OrderIncident } from './incident.entity';
import { Order } from '../orders/order.entity';
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
  ) {}

  async create(createIncidentDto: CreateIncidentDto, proof_image_url?: string) {
    const { orderId, shipperId, reason, description } = createIncidentDto;

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const shipper = await this.userRepository.findOne({
      where: { id: shipperId },
    });
    if (!shipper) {
      throw new NotFoundException(`Shipper with ID ${shipperId} not found`);
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

  async findAll() {
    return this.incidentRepository.find({
      relations: {
        order: true,
        shipper: true,
        resolvedBy: true,
      },
    });
  }

  async resolve(id: string, resolveDto: ResolveIncidentDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const incident = await queryRunner.manager.findOne(OrderIncident, {
        where: { id },
        relations: {
          order: true,
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
      }

      incident.resolvedBy = resolvedBy;
      if (resolveDto.resolution_notes) {
        incident.resolution_notes = resolveDto.resolution_notes;
      }

      await queryRunner.manager.save(order);
      const updatedIncident = await queryRunner.manager.save(incident);

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
