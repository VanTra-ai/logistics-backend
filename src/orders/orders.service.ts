import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { HubsService } from '../hubs/hubs.service';
import { TrackingsService } from '../trackings/trackings.service'; // <-- Phải import ở đây

export class CreateOrderDto {
  sender_name!: string;
  sender_phone!: string;
  sender_address!: string;
  receiver_name!: string;
  receiver_phone!: string;
  receiver_address!: string;
  weight!: number;
  cod_amount!: number;
  note?: string;
  pickup_hub_id!: string;
}

export class UpdateOrderStatusDto {
  status!: string;
  note?: string;
  lat?: number;
  long?: number;
  incident_image_url?: string;
  delivery_image_url?: string;
}

@Injectable()
export class OrdersService {
  // KHAI BÁO CÁC SERVICE SẼ SỬ DỤNG Ở ĐÂY
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private hubsService: HubsService,
    private trackingsService: TrackingsService, // <-- Phải có dòng này thì this.trackingsService mới hoạt động
  ) {}

  private generateTrackingNumber(): string {
    const prefix = 'VN';
    const year = new Date().getFullYear().toString();
    const randomChars = Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();
    return `${prefix}${year}${randomChars}`;
  }

  async createOrder(data: CreateOrderDto): Promise<Order> {
    const hub = await this.hubsService.findById(data.pickup_hub_id);
    if (!hub) {
      throw new NotFoundException('Bưu cục không tồn tại trong hệ thống!');
    }

    const trackingNumber = this.generateTrackingNumber();

    const newOrder = this.ordersRepository.create({
      tracking_number: trackingNumber,
      current_status: 'PENDING',
      sender_name: data.sender_name,
      sender_phone: data.sender_phone,
      sender_address: data.sender_address,
      receiver_name: data.receiver_name,
      receiver_phone: data.receiver_phone,
      receiver_address: data.receiver_address,
      weight: data.weight,
      cod_amount: data.cod_amount,
      note: data.note,
      pickup_hub: hub,
    });

    const savedOrder = await this.ordersRepository.save(newOrder);

    // Tự động ghi lại lịch sử mốc đầu tiên
    await this.trackingsService.addTrackingRecord(
      savedOrder,
      'PENDING',
      'Đơn hàng được tạo mới và chờ lấy hàng',
    );

    return savedOrder;
  }

  async updateOrderStatus(
    id: string,
    data: UpdateOrderStatusDto,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id } });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng!');
    }

    order.current_status = data.status;

    if (data.status === 'FINISHED' && data.delivery_image_url) {
      order.delivery_image_url = data.delivery_image_url;
    }

    const updatedOrder = await this.ordersRepository.save(order);

    const trackingNote = data.note
      ? data.note
      : `Trạng thái đơn hàng cập nhật thành ${data.status}`;

    // Tự động ghi lịch sử
    await this.trackingsService.addTrackingRecord(
      updatedOrder,
      data.status,
      trackingNote,
      data.lat,
      data.long,
      data.incident_image_url,
    );

    return updatedOrder;
  }

  async findAllOrders(): Promise<Order[]> {
    return await this.ordersRepository.find({
      order: { created_at: 'DESC' },
      relations: {
        pickup_hub: true,
      },
    });
  }
}
