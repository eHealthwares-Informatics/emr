import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../../common/tenant-context';
import { NotificationDispatchOrmEntity } from '../entities/notification-dispatch.orm-entity';
import {
  NotificationClientService,
  type NotificationEventDispatch,
} from './notification-client.service';

export type ListNotificationDispatchesQuery = {
  eventKey?: string;
  status?: string;
  source?: string;
  relatedEntityId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

const SORT_WHITELIST = new Set([
  'createdAt',
  'eventKey',
  'status',
  'sentAt',
  'recipientAddress',
]);

/**
 * Read/replay side of the EMR notification dispatch ledger.
 *
 * Sending is instrumented on `NotificationClientService`; this service only
 * lists rows and replays a stored event payload.
 */
@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    @InjectRepository(NotificationDispatchOrmEntity)
    private readonly repo: Repository<NotificationDispatchOrmEntity>,
    private readonly client: NotificationClientService,
  ) {}

  async list(
    query: ListNotificationDispatchesQuery,
    tenant: TenantContext,
    _user?: RequestUser,
  ): Promise<{ data: NotificationDispatchOrmEntity[]; total: number }> {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 25)));

    const qb = this.repo
      .createQueryBuilder('dispatch')
      .where('dispatch.deleted_at IS NULL');
    this.applyTenantScope(qb, tenant);

    if (query.eventKey) {
      qb.andWhere('dispatch.event_key = :eventKey', {
        eventKey: query.eventKey,
      });
    }
    if (query.status) {
      qb.andWhere('dispatch.status = :status', { status: query.status });
    }
    if (query.source) {
      qb.andWhere('dispatch.source = :source', { source: query.source });
    }
    if (query.relatedEntityId) {
      qb.andWhere('dispatch.related_entity_id = :relatedEntityId', {
        relatedEntityId: query.relatedEntityId,
      });
    }
    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(
        '(dispatch.event_key ILIKE :search OR dispatch.subject ILIKE :search OR dispatch.recipient_address ILIKE :search OR dispatch.related_entity_id ILIKE :search)',
        { search },
      );
    }

    const sortBy = SORT_WHITELIST.has(String(query.sortBy))
      ? String(query.sortBy)
      : 'createdAt';
    const order = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    qb.orderBy(`dispatch.${sortBy}`, order)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  /**
   * Re-sends a recorded dispatch. A new ledger row is created by the client so
   * the audit trail keeps the original attempt as well.
   */
  async retrigger(
    id: string,
    tenant: TenantContext,
    _user?: RequestUser,
  ): Promise<{ ok: boolean; sent: number; failed: number; skipped: number }> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Notification dispatch not found');
    }
    if (
      !tenant.isGlobalAdmin &&
      row.organizationId &&
      row.organizationId !== tenant.organizationId
    ) {
      throw new NotFoundException('Notification dispatch not found');
    }

    const payload = this.replayPayload(row);
    const result = await this.client.dispatch(payload);
    this.logger.log(
      `Retriggered notification dispatch ${id} (event=${row.eventKey}) → sent=${result.sent} failed=${result.failed}`,
    );
    return {
      ok: result.ok,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    };
  }

  /** Rebuilds an event payload for rows written before `request_payload`. */
  private replayPayload(
    row: NotificationDispatchOrmEntity,
  ): NotificationEventDispatch {
    const stored = (row.requestPayload ?? {}) as Partial<NotificationEventDispatch>;
    return {
      ...stored,
      source: 'retrigger',
      retriggeredFromId: row.id,
      organizationId: stored.organizationId ?? row.organizationId,
      locationId: stored.locationId ?? row.locationId,
      eventKey: stored.eventKey ?? row.eventKey,
      recipients: stored.recipients ??
        (row.recipients as { phone?: string | null; email?: string | null } | null) ?? {
          phone: row.recipientAddress,
        },
      subject: stored.subject ?? row.subject,
      message: stored.message ?? row.body,
      relatedEntityType: stored.relatedEntityType ?? row.relatedEntityType,
      relatedEntityId: stored.relatedEntityId ?? row.relatedEntityId,
      context: {
        ...(stored.context ?? {}),
        ...(stored.recipients ? {} : { recipients: row.recipients }),
      },
    };
  }

  private applyTenantScope(
    qb: SelectQueryBuilder<NotificationDispatchOrmEntity>,
    tenant: TenantContext,
  ) {
    if (!tenant.isGlobalAdmin && tenant.organizationId) {
      qb.andWhere(
        '(dispatch.organization_id = :orgId OR dispatch.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }
    if (!tenant.isGlobalAdmin && tenant.locationId) {
      qb.andWhere(
        '(dispatch.location_id = :locId OR dispatch.location_id IS NULL)',
        { locId: tenant.locationId },
      );
    }
  }
}
