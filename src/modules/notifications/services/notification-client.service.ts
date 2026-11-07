import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export type ConversationMessageTemplate = {
  id: string;
  organizationId: string | null;
  code: string;
  name: string;
  description: string | null;
  type: string;
  contentType?: string | null;
  content?: string | null;
  body?: string | null;
  maxCharacters?: number | null;
  heartbeatRetries?: number;
  heartbeatIntervalSeconds?: number;
  heartbeatExpirySeconds?: number;
  status?: string;
  isActive?: boolean;
  updatedAt?: string;
};

export type NotificationDispatchPayload = {
  organizationId?: string | null;
  eventKey?: string | null;
  channels: string[];
  recipients: { phone?: string | null; email?: string | null };
  subject?: string;
  message?: string;
  html?: string;
  context?: Record<string, unknown>;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

export type NotificationDispatchResult = {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  deliveries: string[];
};

/**
 * HTTP client for the conversation engine: message templates + the producer
 * notification dispatch endpoint.
 *
 * EMR is a producer like HealthStack, LIMS and RxSoft: it renders the message
 * locally and sends it through `POST /notification-dispatch/payload`, letting
 * conversation resolve channels and own the delivery ledger.
 */
@Injectable()
export class NotificationClientService {
  private readonly logger = new Logger(NotificationClientService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private baseUrl(): string {
    return this.config.get<string>(
      'CONVERSATION_API_URL',
      'http://localhost:8090/api',
    );
  }

  private messageTemplatesUrl(): string {
    return `${this.baseUrl()}/message-templates`;
  }

  private dispatchUrl(): string {
    return `${this.baseUrl()}/notification-dispatch/payload`;
  }

  private apiKey(): string {
    return this.config.get<string>('INTEROP_API_KEY', 'emr-interop-key-dev');
  }

  /**
   * Fetch the active message template for `code`, preferring an org-scoped row
   * over the global default. Returns null when none is configured.
   */
  async findMessageTemplate(
    code: string,
    organizationId: string | null,
  ): Promise<ConversationMessageTemplate | null> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<{ data: ConversationMessageTemplate[] }>(
          this.messageTemplatesUrl(),
          {
            params: {
              search: code,
              status: 'active',
              ...(organizationId ? { organizationId } : {}),
              limit: 20,
            },
            headers: { 'x-api-key': this.apiKey() },
          },
        ),
      );

      const rows = (data?.data ?? []).filter(
        (row) => row.code === code && (row.status ?? 'active') === 'active',
      );
      // Org-scoped row wins over global (organizationId null).
      const scoped = rows.find((row) => row.organizationId != null);
      return scoped ?? rows[0] ?? null;
    } catch (err) {
      this.logger.warn(
        `Conversation message-template lookup failed for ${code}: ${err}`,
      );
      return null;
    }
  }

  /**
   * Dispatch a rendered notification through the conversation notification
   * engine. Never throws — notification failures must not fail the business
   * operation that triggered them.
   */
  async dispatch(
    payload: NotificationDispatchPayload,
  ): Promise<NotificationDispatchResult> {
    const channels = (payload.channels ?? []).filter(Boolean);
    const empty: NotificationDispatchResult = {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      deliveries: [],
    };
    if (!channels.length) return empty;

    const hasRecipient = channels.some((channel) =>
      channel === 'email'
        ? Boolean(payload.recipients?.email)
        : Boolean(payload.recipients?.phone),
    );
    if (!hasRecipient) return { ...empty, skipped: 1 };

    try {
      const { data } = await firstValueFrom(
        this.http.post<{
          sent?: number;
          failed?: number;
          skipped?: number;
          deliveries?: string[];
        }>(
          this.dispatchUrl(),
          { ...payload, channels },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey(),
            },
          },
        ),
      );

      const sent = Number(data?.sent ?? 0);
      return {
        ok: sent > 0,
        sent,
        failed: Number(data?.failed ?? 0),
        skipped: Number(data?.skipped ?? 0),
        deliveries: Array.isArray(data?.deliveries) ? data.deliveries : [],
      };
    } catch (err) {
      this.logger.warn(
        `Conversation notification dispatch failed for ${payload.eventKey ?? 'notification'}: ${err}`,
      );
      return { ...empty, failed: 1 };
    }
  }

  /** Render a template body with token substitution (local copy). */
  render(
    body: string | null | undefined,
    values: Record<string, string>,
  ): string {
    return String(body ?? '').replace(
      /\{\{\s*([\w.]+)\s*\}\}/g,
      (_match, key: string) => values[key] ?? '',
    );
  }
}
