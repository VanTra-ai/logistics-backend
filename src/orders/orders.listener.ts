import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { TrackingsService } from '../trackings/trackings.service';
import { Order } from './order.entity';

export interface OrderStatusChangedEvent {
  order: Order;
  status: string;
  note: string;
  lat?: number;
  long?: number;
  imageUrl?: string;
  manager?: EntityManager; // Dành cho transaction
}

@Injectable()
export class OrdersListener {
  constructor(private readonly trackingsService: TrackingsService) {}

  @OnEvent('order.status.changed')
  async handleOrderStatusChangedEvent(event: OrderStatusChangedEvent) {
    const { order, status, note, lat, long, imageUrl, manager } = event;

    if (manager) {
      await this.trackingsService.addTrackingRecordWithManager(manager, {
        order,
        status,
        note,
        lat,
        long,
        imageUrl,
      });
    } else {
      await this.trackingsService.addTrackingRecord({
        order,
        status,
        note,
        lat,
        long,
        imageUrl,
      });
    }
  }
}
