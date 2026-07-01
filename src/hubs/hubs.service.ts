import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hub } from './hub.entity';

// Định nghĩa khuôn dữ liệu gửi lên khi tạo Hub
export class CreateHubDto {
  name!: string;
  address!: string;
}

@Injectable()
export class HubsService {
  constructor(
    @InjectRepository(Hub)
    private hubsRepository: Repository<Hub>,
  ) {}

  // 1. Hàm tạo bưu cục mới
  async createHub(data: CreateHubDto): Promise<Hub> {
    const newHub = this.hubsRepository.create(data);
    return await this.hubsRepository.save(newHub);
  }

  // 2. Hàm lấy danh sách tất cả bưu cục
  async findAllHubs(): Promise<Hub[]> {
    return await this.hubsRepository.find({
      order: { created_at: 'DESC' }, // Sắp xếp bưu cục mới tạo lên đầu
    });
  }

  //3. Tìm bưu cục
  async findById(id: string): Promise<Hub | null> {
    return await this.hubsRepository.findOne({ where: { id } });
  }
}
