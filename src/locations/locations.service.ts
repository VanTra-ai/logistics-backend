import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Location } from './location.entity';
import { Order } from '../orders/order.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationsRepository: Repository<Location>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(hubId?: string, zone?: string, status?: string) {
    const query = this.locationsRepository
      .createQueryBuilder('location')
      .leftJoinAndSelect('location.hub', 'hub')
      .leftJoinAndSelect('location.orders', 'orders')
      .orderBy('location.zone', 'ASC')
      .addOrderBy('location.aisle', 'ASC')
      .addOrderBy('location.shelf', 'ASC')
      .addOrderBy('location.bin', 'ASC');

    if (hubId) {
      query.andWhere('hub.id = :hubId', { hubId });
    }
    if (zone) {
      query.andWhere('location.zone = :zone', { zone });
    }
    if (status) {
      query.andWhere('location.status = :status', { status });
    }

    return await query.getMany();
  }

  async create(data: Partial<Location>) {
    const location = this.locationsRepository.create(data);
    if (!location.barcode) {
      location.barcode =
        `LOC-${data.zone}-${data.aisle}-${data.shelf}-${data.bin}`.toUpperCase();
    }
    return await this.locationsRepository.save(location);
  }

  async delete(id: string) {
    const location = await this.locationsRepository.findOne({ where: { id } });
    if (!location) {
      throw new NotFoundException('Không tìm thấy vị trí kệ hàng');
    }
    if (location.status !== 'EMPTY') {
      throw new BadRequestException('Chỉ có thể xoá kệ hàng trống');
    }
    await this.locationsRepository.remove(location);
    return { message: 'Đã xoá vị trí kệ hàng' };
  }

  async putaway(orderId: string, barcode: string) {
    return await this.dataSource.transaction(async (manager) => {
      const location = await manager.findOne(Location, {
        where: { barcode },
        relations: { orders: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!location) {
        throw new NotFoundException(
          'Không tìm thấy vị trí kệ hàng với mã vạch này',
        );
      }

      if (location.status === 'FULL') {
        throw new BadRequestException('Vị trí kệ hàng đã đầy');
      }

      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: { location: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      if (order.location) {
        throw new BadRequestException('Đơn hàng này đã được xếp lên kệ');
      }

      // Assign order to location
      order.location = location;
      await manager.save(order);

      // Update location status
      const currentOrdersCount = location.orders.length + 1;
      if (currentOrdersCount >= location.max_capacity) {
        location.status = 'FULL';
      } else {
        location.status = 'OCCUPIED';
      }
      await manager.save(location);

      return { message: 'Đã xếp đơn hàng lên kệ thành công', order, location };
    });
  }
}
