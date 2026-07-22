import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, FindOptionsWhere } from 'typeorm';
import { VietnamProvince, VietnamWard } from './geo.entity';

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(VietnamProvince)
    private readonly provinceRepo: Repository<VietnamProvince>,
    @InjectRepository(VietnamWard)
    private readonly wardRepo: Repository<VietnamWard>,
  ) {}

  async getProvinces() {
    return await this.provinceRepo.find({
      order: { name: 'ASC' },
    });
  }

  async getWards(provinceCode: string, search?: string) {
    const whereCondition: FindOptionsWhere<VietnamWard> = {};
    if (provinceCode) {
      whereCondition.province_code = provinceCode;
    }
    if (search) {
      whereCondition.name = ILike(`%${search}%`);
    }

    return await this.wardRepo.find({
      where: whereCondition,
      order: { name: 'ASC' },
      take: 100, // Limit results for performance
    });
  }
}
