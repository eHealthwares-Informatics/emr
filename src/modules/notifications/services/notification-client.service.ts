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

/**
 * HTTP client for the conversation engine's message-template endpoints.
 * emr calls this instead of accessing the message_templates table directly.
 */
@Injectable()
export class NotificationClientService {
  private readonly logger = new Logger(NotificationClientService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private messageTemplatesUrl(): string {
    return (
      this.config.get<string>(
        'CONVERSATION_API_URL',
        'http://localhost:8090/api',
      ) + '/message-templates'
    );
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
      this.logger.warn(`Conversation message-template lookup failed for ${code}: ${err}`);
      return null;
    }
  }

  /** Render a template body with token substitution (local copy). */
  render(body: string | null | undefined, values: Record<string, string>): string {
    return String(body ?? '').replace(
      /\{\{\s*([\w.]+)\s*\}\}/g,
      (_match, key: string) => values[key] ?? '',
    );
  }
}
