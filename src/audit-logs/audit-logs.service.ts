import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
    entityName?: string,
    action?: string,
    startDate?: string,
    endDate?: string,
    searchUser?: string,
  ): Promise<{ data: AuditLog[]; meta: any }> {
    const query = this.auditLogRepository
      .createQueryBuilder('auditLog')
      .leftJoinAndSelect('auditLog.user', 'user');

    if (entityName) {
      query.andWhere('auditLog.entityName = :entityName', { entityName });
    }
    if (action && action !== 'ALL') {
      query.andWhere('auditLog.action = :action', { action });
    }
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.andWhere('auditLog.createdAt >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.andWhere('auditLog.createdAt <= :endDate', { endDate: end });
    }
    if (searchUser) {
      query.andWhere(
        '(user.full_name ILIKE :searchUser OR user.email ILIKE :searchUser)',
        { searchUser: `%${searchUser}%` },
      );
    }

    query.skip((page - 1) * limit).take(limit);
    query.orderBy('auditLog.createdAt', 'DESC');

    const [data, totalItems] = await query.getManyAndCount();
    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
      },
    };
  }
}
