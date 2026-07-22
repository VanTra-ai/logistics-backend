import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { TrackingHistory } from './tracking.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

interface TrackingData {
  order: Order;
  operatorId?: string;
  status: string;
  note?: string;
  lat?: number;
  long?: number;
  imageUrl?: string;
}

@Injectable()
export class TrackingsService {
  constructor(
    @InjectRepository(TrackingHistory)
    private trackingsRepository: Repository<TrackingHistory>,
  ) {}

  async addTrackingRecord(data: TrackingData): Promise<TrackingHistory> {
    const newTracking = this.trackingsRepository.create({
      order: data.order,
      operator: data.operatorId ? { id: data.operatorId } : undefined,
      status: data.status,
      note: data.note || '',
      lat: data.lat,
      long: data.long,
      image_url: data.imageUrl,
    });
    return await this.trackingsRepository.save(newTracking);
  }

  async addTrackingRecordWithManager(
    manager: EntityManager,
    data: TrackingData,
  ): Promise<TrackingHistory> {
    const newTracking = manager.create(TrackingHistory, {
      order: data.order,
      operator: data.operatorId ? ({ id: data.operatorId } as User) : undefined,
      status: data.status,
      note: data.note || '',
      lat: data.lat,
      long: data.long,
      image_url: data.imageUrl,
    });
    return await manager.save(TrackingHistory, newTracking);
  }

  async findByOrderId(orderId: string): Promise<TrackingHistory[]> {
    return await this.trackingsRepository.find({
      where: { order: { id: orderId } },
      relations: { operator: true },
      order: { created_at: 'DESC' },
    });
  }
}
