import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackingHistory } from './tracking.entity';
import { Order } from '../orders/order.entity';

@Injectable()
export class TrackingsService {
  constructor(
    @InjectRepository(TrackingHistory)
    private trackingsRepository: Repository<TrackingHistory>,
  ) {}

  // Hàm tự động ghi lại lịch sử đơn hàng (Hỗ trợ thêm GPS và Ảnh)
  async addTrackingRecord(
    order: Order,
    status: string,
    note?: string,
    lat?: number,
    long?: number,
    imageUrl?: string,
  ): Promise<TrackingHistory> {
    const newTracking = this.trackingsRepository.create({
      order: order,
      status: status,
      note: note || '',
      lat: lat,
      long: long,
      image_url: imageUrl,
    });

    return await this.trackingsRepository.save(newTracking);
  }

  async findByOrderId(orderId: string): Promise<TrackingHistory[]> {
    return await this.trackingsRepository.find({
      where: { order: { id: orderId } },
      order: { created_at: 'DESC' },
    });
  }
}
