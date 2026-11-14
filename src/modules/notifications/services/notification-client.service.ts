import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import {
  NotificationDispatchOrmEntity,
  type NotificationDispatchSource,
} from '../entities/notification-dispatch.orm-entity';

export type NotificationEventDispatch = {
  organizationId?: string | null;
  locationId?: string | null;
  /** Notification event key/name/code/id. */
  eventKey: string;
  /**
   * Template variables, recipients and related ids. EMR renders nothing and
   * selects no channel; conversation owns templates, channels and delivery.
   */
  context?: Record<string, unknown>;
  recipients?: { phone?: string | null; email?: string | null };
  subject?: string | null;
  message?: string | null;
  html?: string | null;
  printFormat?: 'a4_print' | 'pos_print' | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  contextId?: string | null;
  /** Where the dispatch originated (ledger metadata). */
  source?: NotificationDispatchSource;
  /** Original ledger row when this dispatch is a re-trigger. */
  retriggeredFromId?: string | null;
};

export type NotificationDispatchResult = {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  deliveries: string[];
  /** Print artifacts generated from the template's a4_print/pos_print bodies. */
  prints?: Record<string, unknown> | null;
};

/**
 * HTTP client for the conversation engine: message templates + the producer
 * notification event endpoint.
 *
 * EMR is a producer like HealthStack, LIMS and RxSoft: it sends an event key
 * plus context. Conversation resolves the notification template, channels,
 * recipients and delivery ledger.
 */
@Injectable()
export class NotificationClientService {
  private readonly logger = new Logger(NotificationClientService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @Optional()
    @InjectRepository(NotificationDispatchOrmEntity)
    private readonly dispatchRepo?: Repository<NotificationDispatchOrmEntity>,
  ) {}

  private baseUrl(): string {
    return this.config.get<string>(
      'CONVERSATION_API_URL',
      'http://localhost:8090/api',
    );
  }

  private dispatchUrl(): string {
    return `${this.baseUrl()}/notification-dispatch/send`;
  }

  private apiKey(): string {
    return this.config.get<string>('INTEROP_API_KEY', 'emr-interop-key-dev');
  }

  /**
   * Dispatch a notification event. Never throws — notification failures must
   * not fail the business operation that triggered them.
   */
  async dispatch(
    payload: NotificationEventDispatch,
  ): Promise<NotificationDispatchResult> {
    const empty: NotificationDispatchResult = {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 1,
      deliveries: [],
    };
    if (!payload.eventKey) return empty;

    // Sender-app ledger: record what we are about to send so the EMR UI can
    // show history and re-trigger it later. Ledger failures never block sends.
    const ledger = await this.startLedger(payload);

    try {
      const context = (payload.context ?? {}) as Record<string, unknown>;
      const recipients = this.resolveRecipients(payload, context);
      const { data } = await firstValueFrom(
        this.http.post<{
          sent?: number;
          failed?: number;
          skipped?: number;
          deliveries?: string[];
        }>(
          this.dispatchUrl(),
          {
            // Normalised contract: eventKey + organizationId + recipients +
            // context. Media overrides ride alongside (optional).
            organizationId: payload.organizationId ?? null,
            eventKey: payload.eventKey,
            recipients,
            context,
            ...(payload.printFormat ? { printFormat: payload.printFormat } : {}),
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey(),
            },
          },
        ),
      );

      const sent = Number(data?.sent ?? 0);
      const failed = Number(data?.failed ?? 0);
      const skipped = Number(data?.skipped ?? 0);
      const deliveries = Array.isArray(data?.deliveries) ? data.deliveries : [];

      const result = {
        ok: sent > 0,
        sent,
        failed,
        skipped,
        deliveries,
        prints: (data as { prints?: Record<string, unknown> | null })?.prints ?? null,
      };
      await this.finishLedger(ledger, result);
      return result;
    } catch (err) {
      this.logger.warn(
        `Conversation notification dispatch failed for ${payload.eventKey}: ${err}`,
      );
      await this.failLedger(ledger, err);
      return { ...empty, failed: 1, skipped: 0 };
    }
  }

  // ------------------------------------------------------------- ledger

  /** Creates the PENDING ledger row for a dispatch. Never throws. */
  private async startLedger(
    payload: NotificationEventDispatch,
  ): Promise<NotificationDispatchOrmEntity | null> {
    if (!this.dispatchRepo) return null;
    try {
      const context = (payload.context ?? {}) as Record<string, unknown>;
      const recipients = this.resolveRecipients(payload, context);
      const address = [recipients.phone, recipients.email]
        .filter(Boolean)
        .join(', ');

      return await this.dispatchRepo.save(
        this.dispatchRepo.create({
          organizationId: payload.organizationId ?? null,
          locationId: payload.locationId ?? null,
          eventKey: payload.eventKey,
          sourceApp: 'emr',
          source: payload.source ?? 'notification_client',
          recipientAddress: address || null,
          recipients: recipients as unknown as Record<string, unknown>,
          subject:
            payload.subject ?? (context.subject as string | undefined) ?? null,
          body:
            payload.message ??
            (context.message as string | undefined) ??
            (context.body as string | undefined) ??
            null,
          status: 'PENDING',
          sentCount: 0,
          failedCount: 0,
          skippedCount: 0,
          deliveries: null,
          exchangeId: null,
          error: null,
          attempts: 1,
          relatedEntityType:
            payload.relatedEntityType ??
            (context.relatedEntityType as string | undefined) ??
            null,
          relatedEntityId:
            payload.relatedEntityId ??
            (context.relatedEntityId as string | undefined) ??
            null,
          requestPayload: payload as unknown as Record<string, unknown>,
          retriggeredFromId: payload.retriggeredFromId ?? null,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Notification dispatch ledger create failed for ${payload.eventKey}: ${err}`,
      );
      return null;
    }
  }

  private async finishLedger(
    ledger: NotificationDispatchOrmEntity | null,
    result: NotificationDispatchResult,
  ): Promise<void> {
    if (!ledger || !this.dispatchRepo) return;
    const status =
      result.sent > 0 && result.failed === 0
        ? 'SENT'
        : result.sent > 0
          ? 'PARTIAL'
          : result.failed > 0
            ? 'FAILED'
            : 'SKIPPED';
    try {
      await this.dispatchRepo.update(
        { id: ledger.id },
        {
          status,
          sentCount: result.sent,
          failedCount: result.failed,
          skippedCount: result.skipped,
          deliveries: result.deliveries,
          exchangeId: result.deliveries[0] ?? null,
          sentAt: result.sent > 0 ? new Date() : null,
          error: status === 'FAILED' ? 'Conversation notification dispatch failed' : null,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Notification dispatch ledger update failed for ${ledger.id}: ${err}`,
      );
    }
  }

  private async failLedger(
    ledger: NotificationDispatchOrmEntity | null,
    err: unknown,
  ): Promise<void> {
    if (!ledger || !this.dispatchRepo) return;
    try {
      await this.dispatchRepo.update(
        { id: ledger.id },
        {
          status: 'FAILED',
          failedCount: 1,
          error: (err as Error)?.message ?? String(err),
        },
      );
    } catch (updateErr) {
      this.logger.warn(
        `Notification dispatch ledger failure update failed for ${ledger.id}: ${updateErr}`,
      );
    }
  }

  private resolveRecipients(
    payload: NotificationEventDispatch,
    context: Record<string, unknown>,
  ): { phone?: string | null; email?: string | null } {
    const fromContext = context.recipients as
      | { phone?: string | null; email?: string | null }
      | undefined;
    return {
      phone:
        payload.recipients?.phone ??
        fromContext?.phone ??
        (context.phone as string | undefined) ??
        null,
      email:
        payload.recipients?.email ??
        fromContext?.email ??
        (context.email as string | undefined) ??
        null,
    };
  }

}
