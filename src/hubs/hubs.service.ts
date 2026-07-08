import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hub } from './hub.entity';
import { Order } from '../orders/order.entity';
import { Shipment } from '../shipments/shipment.entity';
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateHubDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên bưu cục không được để trống!' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ bưu cục không được để trống!' })
  address!: string;
}

export class UpdateHubDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean; // Dùng để bật/tắt hoạt động
}

@Injectable()
export class HubsService {
  constructor(
    @InjectRepository(Hub)
    private hubsRepository: Repository<Hub>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Shipment)
    private shipmentsRepository: Repository<Shipment>,
  ) {}

  private generateHubCode(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    return `HUB${timestamp}${random}`;
  }

  // Hàm tạo bưu cục mới
  async createHub(data: CreateHubDto): Promise<Hub> {
    const hubCode = this.generateHubCode();
    const newHub = this.hubsRepository.create({
      ...data,
      hub_code: hubCode,
    });
    return await this.hubsRepository.save(newHub);
  }

  // Hàm lấy danh sách tất cả bưu cục
  async findAllHubs(): Promise<Hub[]> {
    return await this.hubsRepository.find({
      order: { created_at: 'DESC' }, // Sắp xếp bưu cục mới tạo lên đầu
    });
  }

  // Tìm bưu cục
  async findById(id: string): Promise<Hub | null> {
    return await this.hubsRepository.findOne({ where: { id } });
  }

  // Hàm cập nhật thông tin bưu cục
  async updateHub(id: string, data: UpdateHubDto): Promise<Hub> {
    const hub = await this.findById(id);
    if (!hub) throw new NotFoundException('Không tìm thấy bưu cục!');

    Object.assign(hub, data); // Trộn dữ liệu mới vào dữ liệu cũ
    return await this.hubsRepository.save(hub);
  }

  // Hàm vô hiệu hóa bưu cục (Soft Delete) có kiểm tra tồn kho
  async deactivateHub(id: string): Promise<Hub> {
    const hub = await this.findById(id);
    if (!hub) throw new NotFoundException('Không tìm thấy bưu cục!');

    // KIỂM TRA NGHIỆP VỤ: Còn đơn hàng nào đang nằm ở Hub này không?
    const pendingOrders = await this.ordersRepository.count({
      where: {
        pickup_hub: { id: hub.id },
        current_status: 'AT_HUB',
      },
    });

    if (pendingOrders > 0) {
      throw new BadRequestException(
        `Không thể đóng cửa! Bưu cục này vẫn còn ${pendingOrders} đơn hàng đang tồn kho.`,
      );
    }

    hub.is_active = false; // Soft delete
    return await this.hubsRepository.save(hub);
  }

  async getHubShipments(hubId: string): Promise<Shipment[]> {
    const hub = await this.findById(hubId);
    if (!hub) throw new NotFoundException('Không tìm thấy bưu cục!');

    return await this.shipmentsRepository.find({
      where: [
        { origin_hub: { id: hubId } }, // Xe xuất phát từ đây
        { destination_hub: { id: hubId } }, // Xe đang cập bến tới đây
      ],
      relations: {
        origin_hub: true,
        destination_hub: true,
        shipper: true,
      },
      order: { created_at: 'DESC' },
    });
  }
}
