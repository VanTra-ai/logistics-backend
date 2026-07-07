import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { Audit } from './audit.entity';
import { AuditItem } from './audit-item.entity';
import { Location } from '../locations/location.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

@Injectable()
export class AuditsService {
  constructor(
    @InjectRepository(Audit)
    private readonly auditsRepository: Repository<Audit>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(hubId?: string, status?: string) {
    const query = this.auditsRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.created_by', 'created_by')
      .leftJoinAndSelect('audit.hub', 'hub')
      .leftJoinAndSelect('audit.items', 'items')
      .orderBy('audit.created_at', 'DESC');

    if (hubId) {
      query.andWhere('hub.id = :hubId', { hubId });
    }
    if (status) {
      query.andWhere('audit.status = :status', { status });
    }

    return await query.getMany();
  }

  async findOne(id: string) {
    const audit = await this.auditsRepository.findOne({
      where: { id },
      relations: { created_by: true, hub: true, items: { location: true } },
    });

    if (!audit) {
      throw new NotFoundException('Không tìm thấy kỳ kiểm kê');
    }

    return audit;
  }

  async create(data: { zone_filter?: string; hubId?: string }, user: User) {
    const audit = this.auditsRepository.create({
      status: 'DRAFT',
      zone_filter: data.zone_filter,
      created_by: user,
      hub: data.hubId ? { id: data.hubId } : user.hub,
    });
    return await this.auditsRepository.save(audit);
  }

  async start(id: string) {
    const audit = await this.findOne(id);
    if (audit.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ có thể bắt đầu kỳ kiểm kê ở trạng thái DRAFT',
      );
    }
    audit.status = 'IN_PROGRESS';
    return await this.auditsRepository.save(audit);
  }

  async complete(id: string) {
    const audit = await this.findOne(id);
    if (audit.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Chỉ có thể hoàn tất kỳ kiểm kê ở trạng thái IN_PROGRESS',
      );
    }
    audit.status = 'COMPLETED';
    return await this.auditsRepository.save(audit);
  }

  async submit(
    auditId: string,
    locationBarcode: string,
    scannedTrackingNumbers: string[],
  ) {
    return await this.dataSource.transaction(async (manager) => {
      const audit = await manager.findOne(Audit, {
        where: { id: auditId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!audit) throw new NotFoundException('Kỳ kiểm kê không tồn tại');
      if (audit.status !== 'IN_PROGRESS')
        throw new BadRequestException(
          'Kỳ kiểm kê không ở trạng thái IN_PROGRESS',
        );

      const location = await manager.findOne(Location, {
        where: { barcode: locationBarcode },
      });
      if (!location)
        throw new NotFoundException('Vị trí kệ hàng không tồn tại');

      // Lấy danh sách đơn hàng đang trên kệ (expected)
      const expectedOrders = await manager.find(Order, {
        where: { location: { id: location.id } },
      });

      // Lấy danh sách đơn hàng đã quét (scanned)
      const scannedOrders = await manager.find(Order, {
        where: { tracking_number: In(scannedTrackingNumbers) },
      });

      const expectedMap = new Map(
        expectedOrders.map((o) => [o.tracking_number, o]),
      );
      const scannedMap = new Map(
        scannedOrders.map((o) => [o.tracking_number, o]),
      );

      const itemsToSave: AuditItem[] = [];

      // Phân tích trạng thái
      // 1. MATCHED: có trong cả expected và scanned
      // 2. MISSING: có trong expected nhưng không có trong scanned
      for (const expected of expectedOrders) {
        if (scannedMap.has(expected.tracking_number)) {
          // MATCHED
          const item = manager.create(AuditItem, {
            audit,
            location,
            expected_order_id: expected.id,
            scanned_order_id: expected.id,
            expected_tracking: expected.tracking_number,
            scanned_tracking: expected.tracking_number,
            status: 'MATCHED',
          });
          itemsToSave.push(item);
        } else {
          // MISSING
          const item = manager.create(AuditItem, {
            audit,
            location,
            expected_order_id: expected.id,
            expected_tracking: expected.tracking_number,
            status: 'MISSING',
          });
          itemsToSave.push(item);
        }
      }

      // 3. WRONG_LOCATION: không có trong expected nhưng có trong scanned
      for (const scanned of scannedOrders) {
        if (!expectedMap.has(scanned.tracking_number)) {
          const item = manager.create(AuditItem, {
            audit,
            location,
            scanned_order_id: scanned.id,
            scanned_tracking: scanned.tracking_number,
            status: 'WRONG_LOCATION',
          });
          itemsToSave.push(item);
        }
      }

      await manager.save(AuditItem, itemsToSave);

      return {
        message: 'Đã lưu kết quả kiểm kê',
        itemsCount: itemsToSave.length,
      };
    });
  }
}
