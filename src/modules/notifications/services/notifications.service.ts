import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';
import { NotificationRecipientOrmEntity } from '../entities/notification-recipient.orm-entity';
import { NotificationSubscriptionOrmEntity } from '../entities/notification-subscription.orm-entity';
import type { RequestOrmEntity } from '../../requests/entities/request.orm-entity';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import {
  ListNotificationsQueryDto,
  SubscribeNotificationsDto,
} from '../dto/notification.dto';
import {
  REQUEST_CREATED_TEMPLATE_CODE,
  TemplateRenderService,
} from './template-render.service';

const RETRY_SWEEP_INTERVAL_MS = 30_000;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private sweeper?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(NotificationOrmEntity)
    private readonly notificationRepo: Repository<NotificationOrmEntity>,
    @InjectRepository(NotificationRecipientOrmEntity)
    private readonly recipientRepo: Repository<NotificationRecipientOrmEntity>,
    @InjectRepository(NotificationSubscriptionOrmEntity)
    private readonly subscriptionRepo: Repository<NotificationSubscriptionOrmEntity>,
    private readonly templateRenderService: TemplateRenderService,
  ) {}

  onModuleInit() {
    // Background heartbeat sweeper for undelivered recipients. Phase 1 in-app
    // delivery is synchronous, so this is normally a no-op; it exists so the
    // retry/expiry model is enforced as soon as non-in-app destinations land.
    this.sweeper = setInterval(() => {
      void this.processRetries().catch(() => undefined);
    }, RETRY_SWEEP_INTERVAL_MS);
    this.sweeper.unref?.();
  }

  onModuleDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  /**
   * Renders the `request_created` template and fans out to every active
   * subscription matching the request's org + location. Never throws for
   * callers that use it fire-and-forget.
   */
  async notifyRequestCreated(
    request: Pick<
      RequestOrmEntity,
      | 'id'
      | 'requestNumber'
      | 'patientName'
      | 'organizationId'
      | 'locationId'
      | 'createdAt'
    >,
    tenant: TenantContext,
  ): Promise<void> {
    const organizationId =
      request.organizationId ?? tenant.organizationId ?? null;
    const locationId = request.locationId ?? tenant.locationId ?? null;

    const template = await this.templateRenderService.resolveActiveTemplate(
      REQUEST_CREATED_TEMPLATE_CODE,
      { organizationId },
    );
    const rendered = this.templateRenderService.render(template, {
      request_ref: request.requestNumber,
      patient_name: request.patientName ?? '',
      created_at: new Date(request.createdAt ?? new Date()).toISOString(),
    });

    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({
        title: rendered.title,
        body: rendered.content,
        type: 'info',
        sourceEntityType: 'request',
        sourceEntityId: request.id,
        sourceEntityRef: request.requestNumber ?? null,
        organizationId,
        locationId,
      }),
    );

    const userIds = await this.resolveRecipients(organizationId, locationId);
    if (userIds.length === 0) return;

    const now = new Date();
    const recipients = userIds.map((userId) =>
      this.recipientRepo.create({
        notificationId: notification.id,
        userId,
        read: false,
        readAt: null,
        delivered: true,
        deliveredAt: now,
        retryCount: 0,
        abandoned: false,
      }),
    );
    await this.recipientRepo.save(recipients);
  }

  async list(
    query: ListNotificationsQueryDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const qb = this.recipientRepo
      .createQueryBuilder('recipient')
      .innerJoinAndSelect('recipient.notification', 'notification')
      .where('notification.deleted_at IS NULL')
      .andWhere('recipient.user_id = :userId', { userId: user.sub });

    if (query.since) {
      const since = new Date(query.since);
      if (!Number.isNaN(since.getTime())) {
        qb.andWhere('notification.created_at > :since', { since });
      }
    }
    this.applyTenantScope(qb, tenant);

    const [rows, total] = await qb
      .orderBy('notification.created_at', 'DESC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    const data = rows.map((recipient) => ({
      id: recipient.notification.id,
      title: recipient.notification.title,
      body: recipient.notification.body,
      type: recipient.notification.type,
      sourceEntityType: recipient.notification.sourceEntityType,
      sourceEntityId: recipient.notification.sourceEntityId,
      sourceEntityRef: recipient.notification.sourceEntityRef,
      organizationId: recipient.notification.organizationId,
      locationId: recipient.notification.locationId,
      read: recipient.read,
      readAt: recipient.readAt,
      createdAt: recipient.notification.createdAt,
    }));

    return { data, total };
  }

  async unreadCount(tenant: TenantContext, user: RequestUser) {
    const qb = this.recipientRepo
      .createQueryBuilder('recipient')
      .innerJoin('recipient.notification', 'notification')
      .where('notification.deleted_at IS NULL')
      .andWhere('recipient.user_id = :userId', { userId: user.sub })
      .andWhere('recipient.read = false');
    this.applyTenantScope(qb, tenant);
    return { count: await qb.getCount() };
  }

  async markRead(id: string, tenant: TenantContext, user: RequestUser) {
    const qb = this.recipientRepo
      .createQueryBuilder('recipient')
      .innerJoinAndSelect('recipient.notification', 'notification')
      .where('recipient.notification_id = :id', { id })
      .andWhere('recipient.user_id = :userId', { userId: user.sub })
      .andWhere('notification.deleted_at IS NULL');
    this.applyTenantScope(qb, tenant);

    const recipient = await qb.getOne();
    if (!recipient) {
      throw new NotFoundException('Notification not found');
    }
    if (!recipient.read) {
      recipient.read = true;
      recipient.readAt = new Date();
      await this.recipientRepo.save(recipient);
    }
    return { id, read: recipient.read, readAt: recipient.readAt };
  }

  async markAllRead(tenant: TenantContext, user: RequestUser) {
    const qb = this.recipientRepo
      .createQueryBuilder('recipient')
      .innerJoin('recipient.notification', 'notification')
      .select('recipient.id', 'id')
      .where('notification.deleted_at IS NULL')
      .andWhere('recipient.user_id = :userId', { userId: user.sub })
      .andWhere('recipient.read = false');
    this.applyTenantScope(qb, tenant);

    const rows = await qb.getRawMany<{ id: string }>();
    if (rows.length > 0) {
      await this.recipientRepo.update(
        rows.map((row) => row.id),
        { read: true, readAt: new Date() },
      );
    }
    return { updated: rows.length };
  }

  async subscribe(
    dto: SubscribeNotificationsDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const now = new Date();
    const qb = this.subscriptionRepo
      .createQueryBuilder('subscription')
      .where('subscription.user_id = :userId', { userId: user.sub })
      .andWhere('subscription.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere('subscription.organization_id = :orgId', {
        orgId: tenant.organizationId,
      });
    } else {
      qb.andWhere('subscription.organization_id IS NULL');
    }
    if (tenant.locationId) {
      qb.andWhere('subscription.location_id = :locId', {
        locId: tenant.locationId,
      });
    } else {
      qb.andWhere('subscription.location_id IS NULL');
    }

    let subscription = await qb.getOne();
    if (subscription) {
      subscription.lastHeartbeatAt = now;
      if (dto.expiresAt !== undefined) {
        subscription.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
      }
      return this.subscriptionRepo.save(subscription);
    }

    subscription = this.subscriptionRepo.create({
      userId: user.sub,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      lastHeartbeatAt: now,
    });
    return this.subscriptionRepo.save(subscription);
  }

  /**
   * Applies the heartbeat retry/expiry policy to undelivered recipients.
   * Retry window = heartbeatRetries × heartbeatIntervalSeconds; recipients are
   * abandoned once the window is exhausted or heartbeatExpirySeconds (from
   * notification creation) elapses. Exposed for the background sweeper.
   */
  async processRetries(now: Date = new Date()): Promise<void> {
    const pending = await this.recipientRepo
      .createQueryBuilder('recipient')
      .innerJoinAndSelect('recipient.notification', 'notification')
      .where('notification.deleted_at IS NULL')
      .andWhere('recipient.delivered = false')
      .andWhere('recipient.abandoned = false')
      .getMany();

    if (pending.length === 0) return;

    const template = await this.templateRenderService.resolveActiveTemplate(
      REQUEST_CREATED_TEMPLATE_CODE,
      { organizationId: null },
    );
    const retries = template?.heartbeatRetries ?? 3;
    const intervalSeconds = template?.heartbeatIntervalSeconds ?? 30;
    const expirySeconds = template?.heartbeatExpirySeconds ?? 86400;

    for (const recipient of pending) {
      const createdAt =
        recipient.notification?.createdAt ?? recipient.createdAt;
      const ageSeconds = (now.getTime() - new Date(createdAt).getTime()) / 1000;

      if (ageSeconds > expirySeconds || recipient.retryCount >= retries) {
        recipient.abandoned = true;
      } else if (!recipient.nextRetryAt || recipient.nextRetryAt <= now) {
        recipient.retryCount += 1;
        recipient.lastAttemptAt = now;
        recipient.nextRetryAt = new Date(
          now.getTime() + intervalSeconds * 1000,
        );
      }
    }

    await this.recipientRepo.save(pending);
  }

  private async resolveRecipients(
    organizationId: string | null,
    locationId: string | null,
  ): Promise<string[]> {
    const qb = this.subscriptionRepo
      .createQueryBuilder('subscription')
      .select('DISTINCT subscription.user_id', 'userId')
      .where('subscription.deleted_at IS NULL')
      .andWhere(
        '(subscription.expires_at IS NULL OR subscription.expires_at > :now)',
        {
          now: new Date(),
        },
      );

    // A null-org subscription is a global-admin subscription and matches all.
    if (organizationId) {
      qb.andWhere(
        '(subscription.organization_id = :orgId OR subscription.organization_id IS NULL)',
        { orgId: organizationId },
      );
    }
    if (locationId) {
      qb.andWhere(
        '(subscription.location_id = :locId OR subscription.location_id IS NULL)',
        { locId: locationId },
      );
    }

    const rows = await qb.getRawMany<{ userId: string }>();
    return rows.map((row) => row.userId);
  }

  private applyTenantScope(
    qb: SelectQueryBuilder<NotificationRecipientOrmEntity>,
    tenant: TenantContext,
  ) {
    if (!tenant.isGlobalAdmin && tenant.organizationId) {
      qb.andWhere(
        '(notification.organization_id = :orgId OR notification.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }
    if (!tenant.isGlobalAdmin && tenant.locationId) {
      qb.andWhere(
        '(notification.location_id = :locId OR notification.location_id IS NULL)',
        { locId: tenant.locationId },
      );
    }
  }
}
