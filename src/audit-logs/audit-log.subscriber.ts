/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AuditLog } from './audit-log.entity';

@Injectable()
@EventSubscriber()
export class AuditLogSubscriber implements EntitySubscriberInterface {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cls: ClsService,
  ) {
    dataSource.subscribers.push(this);
  }

  private stripSensitiveData(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const result = { ...obj };
    const sensitiveKeys = [
      'password_hash',
      'refresh_token',
      'token',
      'password',
    ];
    for (const key of sensitiveKeys) {
      if (key in result) {
        delete result[key];
      }
    }
    return result;
  }

  private extractDiff(oldObj: any, newObj: any) {
    const diffOld: any = {};
    const diffNew: any = {};
    const keys = new Set([
      ...Object.keys((oldObj as Record<string, unknown>) || {}),
      ...Object.keys((newObj as Record<string, unknown>) || {}),
    ]);

    for (const key of keys) {
      if (oldObj?.[key] !== newObj?.[key]) {
        diffOld[key] = oldObj?.[key];
        diffNew[key] = newObj?.[key];
      }
    }
    return { diffOld, diffNew };
  }

  afterInsert(event: InsertEvent<any>) {
    if (!event.entity || event.metadata.targetName === 'AuditLog') return;

    const userId = this.cls.isActive() ? this.cls.get('userId') : null;
    const entityId = event.entity.id ? String(event.entity.id) : '';

    const auditLog = new AuditLog();
    auditLog.userId = userId || null;
    auditLog.action = 'INSERT';
    auditLog.entityName = event.metadata.tableName;
    auditLog.entityId = entityId;
    auditLog.newValues = this.stripSensitiveData(event.entity);

    if (
      auditLog.entityName === 'order_materials' ||
      event.metadata.targetName === 'OrderMaterial'
    ) {
      auditLog.subAction = 'PACKAGING';
    }

    event.manager
      .getRepository(AuditLog)
      .insert(auditLog)
      .catch((err) => {
        console.error('Failed to save audit log', err);
      });
  }

  afterUpdate(event: UpdateEvent<any>) {
    if (!event.entity || event.metadata.targetName === 'AuditLog') return;

    const userId = this.cls.isActive() ? this.cls.get('userId') : null;
    const entityId = event.entity.id ? String(event.entity.id) : '';

    const { diffOld, diffNew } = this.extractDiff(
      event.databaseEntity,
      event.entity,
    );

    const auditLog = new AuditLog();
    auditLog.userId = userId || null;
    auditLog.action = 'UPDATE';
    auditLog.entityName = event.metadata.tableName;
    auditLog.entityId = entityId;
    auditLog.oldValues = this.stripSensitiveData(diffOld);
    auditLog.newValues = this.stripSensitiveData(diffNew);

    if (
      auditLog.entityName === 'orders' ||
      event.metadata.targetName === 'Order'
    ) {
      const oldLocationId =
        event.databaseEntity?.location?.id ?? event.databaseEntity?.locationId;
      const newLocationId =
        event.entity?.location?.id ?? event.entity?.locationId;
      if (newLocationId !== undefined && oldLocationId !== newLocationId) {
        auditLog.subAction = 'PUT_AWAY';
      } else if (
        event.entity?.current_status !== undefined &&
        event.databaseEntity?.current_status !== event.entity?.current_status
      ) {
        auditLog.subAction = 'STATUS_CHANGE';
      }
    }

    event.manager
      .getRepository(AuditLog)
      .insert(auditLog)
      .catch((err) => {
        console.error('Failed to save audit log', err);
      });
  }

  beforeRemove(event: RemoveEvent<any>) {
    if (!event.entity || event.metadata.targetName === 'AuditLog') return;

    const userId = this.cls.isActive() ? this.cls.get('userId') : null;
    const entityId = event.entity.id
      ? String(event.entity.id)
      : event.entityId
        ? String(event.entityId)
        : '';

    const auditLog = new AuditLog();
    auditLog.userId = userId || null;
    auditLog.action = 'DELETE';
    auditLog.entityName = event.metadata.tableName;
    auditLog.entityId = entityId;
    auditLog.oldValues = this.stripSensitiveData(event.entity);

    event.manager
      .getRepository(AuditLog)
      .insert(auditLog)
      .catch((err) => {
        console.error('Failed to save audit log', err);
      });
  }
}
