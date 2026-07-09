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
  ): Promise<{ data: AuditLog[]; meta: any }> {
    const query = this.auditLogRepository.createQueryBuilder('auditLog');

    if (entityName) {
      query.andWhere('auditLog.entityName = :entityName', { entityName });
    }
    if (action) {
      query.andWhere('auditLog.action = :action', { action });
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
