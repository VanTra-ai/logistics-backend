import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { Location } from './location.entity';
import { Order } from '../orders/order.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationsRepository: Repository<Location>,
    private readonly dataSource: DataSource,
  ) {}

  async getZones(hubId?: string) {
    const query = this.locationsRepository
      .createQueryBuilder('location')
      .select('DISTINCT location.zone', 'zone')
      .orderBy('location.zone', 'ASC');

    if (hubId) {
      query.leftJoin('location.hub', 'hub');
      query.where('hub.id = :hubId', { hubId });
    }

    const result = await query.getRawMany();
    return result.map((r: { zone: string }) => r.zone);
  }

  async findAll(
    hubId?: string,
    zone?: string,
    status?: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ) {
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
    if (search) {
      query.andWhere('LOWER(location.barcode) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Stats
    const statsQuery = this.locationsRepository
      .createQueryBuilder('location')
      .leftJoin('location.hub', 'hub');

    if (hubId) {
      statsQuery.andWhere('hub.id = :hubId', { hubId });
    }
    if (zone) {
      statsQuery.andWhere('location.zone = :zone', { zone });
    }
    if (search) {
      statsQuery.andWhere('LOWER(location.barcode) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }
    // We don't filter status for stats, because stats should show counts of all statuses

    const statsRaw = await statsQuery
      .select('location.status', 'status')
      .addSelect('COUNT(location.id)', 'count')
      .groupBy('location.status')
      .getRawMany();

    const stats = {
      total: totalItems, // if status is filtered, this is filtered total. Wait!
      empty: 0,
      occupied: 0,
      full: 0,
    };

    let totalUnfiltered = 0;
    statsRaw.forEach((row: { status: string; count: string }) => {
      const count = parseInt(row.count, 10);
      totalUnfiltered += count;
      if (row.status === 'EMPTY') stats.empty = count;
      else if (row.status === 'OCCUPIED') stats.occupied = count;
      else if (row.status === 'FULL') stats.full = count;
    });
    stats.total = totalUnfiltered;

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        stats,
      },
    };
  }

  async create(data: Partial<Location>) {
    const location = this.locationsRepository.create(data);
    if (!location.barcode) {
      location.barcode =
        `LOC-${data.zone}-${data.aisle}-${data.shelf}-${data.bin}`.toUpperCase();
    }
    try {
      return await this.locationsRepository.save(location);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new BadRequestException(
          'Mã vị trí (barcode) này đã tồn tại trong hệ thống',
        );
      }
      throw error;
    }
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
      const locationLock = await manager.findOne(Location, {
        where: { barcode },
        lock: { mode: 'pessimistic_write' },
      });

      if (!locationLock) {
        throw new NotFoundException(
          'Không tìm thấy vị trí kệ hàng với mã vạch này',
        );
      }

      const location = await manager.findOne(Location, {
        where: { barcode },
        relations: { orders: true, hub: true },
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
        relations: { location: true, pickup_hub: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      if (order.location) {
        if (order.location.id === location.id) {
          throw new BadRequestException(
            'Đơn hàng này đã được xếp lên kệ này rồi',
          );
        }
        await this.removeOrderFromLocation(order, manager);
      }

      // Check cross-hub security
      if (
        !order.pickup_hub ||
        !location.hub ||
        order.pickup_hub.id !== location.hub.id
      ) {
        throw new BadRequestException(
          'Đơn hàng và kệ hàng không thuộc cùng một bưu cục!',
        );
      }

      // Assign order to location using update to ensure foreign key is set
      await manager.update(Order, order.id, { location: { id: location.id } });

      // Update location status
      const currentOrdersCount = location.orders.length + 1;
      const newStatus =
        currentOrdersCount >= location.max_capacity ? 'FULL' : 'OCCUPIED';
      await manager.update(Location, location.id, { status: newStatus });

      return {
        message: 'Đã xếp đơn hàng lên kệ thành công',
        order,
        location: { ...location, status: newStatus },
      };
    });
  }

  // Helper method to handle pick-out logic
  async removeOrderFromLocation(
    order: Order,
    manager: EntityManager, // EntityManager from typeorm
  ) {
    if (!order.location) return;

    // Load full location with orders to calculate capacity
    await manager.findOne(Location, {
      where: { id: order.location.id },
      lock: { mode: 'pessimistic_write' },
    });

    const location = await manager.findOne(Location, {
      where: { id: order.location.id },
      relations: { orders: true },
    });

    if (location) {
      // Remove this order from location's order list in memory to count correctly
      const remainingOrdersCount = location.orders.filter(
        (o: Order) => o.id !== order.id,
      ).length;

      let newStatus = location.status;
      if (remainingOrdersCount === 0) {
        newStatus = 'EMPTY';
      } else if (remainingOrdersCount >= location.max_capacity) {
        newStatus = 'FULL';
      } else {
        newStatus = 'OCCUPIED';
      }
      await manager.update(Location, location.id, { status: newStatus });
    }

    order.location = null as any;
    await manager.update(Order, order.id, { location: null as any });
  }
}
