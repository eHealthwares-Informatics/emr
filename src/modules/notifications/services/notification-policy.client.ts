import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type NotificationPolicyChannel = 'whatsapp' | 'sms' | 'email';
export type NotificationPolicyEvent =
  'final_result' | 'appointment' | 'document_creation' | 'bill_creation';

export type NotificationChannelPolicy = {
  enabled: boolean;
  code: string | null;
  fallbackChannel: NotificationPolicyChannel | null;
};

export type NotificationEventPolicy = {
  enabled: boolean;
  channels: Record<NotificationPolicyChannel, boolean>;
};

export type NotificationPolicy = {
  channels: Record<NotificationPolicyChannel, NotificationChannelPolicy>;
  events: Record<NotificationPolicyEvent, NotificationEventPolicy>;
};

const CHANNELS: NotificationPolicyChannel[] = ['whatsapp', 'sms', 'email'];
const EVENTS: NotificationPolicyEvent[] = [
  'final_result',
  'appointment',
  'document_creation',
  'bill_creation',
];

function isChannel(value: unknown): value is NotificationPolicyChannel {
  return CHANNELS.includes(value as NotificationPolicyChannel);
}

export function normalizeNotificationPolicy(raw: unknown): NotificationPolicy {
  const channels = {} as Record<
    NotificationPolicyChannel,
    NotificationChannelPolicy
  >;
  for (const channel of CHANNELS) {
    channels[channel] = { enabled: true, code: null, fallbackChannel: null };
  }
  const events = {} as Record<NotificationPolicyEvent, NotificationEventPolicy>;
  for (const event of EVENTS) {
    events[event] = {
      enabled: true,
      channels: { whatsapp: true, sms: true, email: true },
    };
  }

  if (!raw || typeof raw !== 'object') return { channels, events };
  const source = raw as {
    channels?: Record<string, Partial<NotificationChannelPolicy> | undefined>;
    events?: Record<string, Partial<NotificationEventPolicy> | undefined>;
  };

  for (const channel of CHANNELS) {
    const saved = source.channels?.[channel];
    if (!saved) continue;
    channels[channel] = {
      enabled: saved.enabled !== false,
      code:
        typeof saved.code === 'string' && saved.code.trim()
          ? saved.code.trim()
          : null,
      fallbackChannel:
        isChannel(saved.fallbackChannel) && saved.fallbackChannel !== channel
          ? saved.fallbackChannel
          : null,
    };
  }
  for (const event of EVENTS) {
    const saved = source.events?.[event];
    if (!saved) continue;
    events[event] = {
      enabled: saved.enabled !== false,
      channels: {
        whatsapp: saved.channels?.whatsapp !== false,
        sms: saved.channels?.sms !== false,
        email: saved.channels?.email !== false,
      },
    };
  }
  return { channels, events };
}

export function isChannelEnabled(
  policy: NotificationPolicy | null | undefined,
  channel: NotificationPolicyChannel,
): boolean {
  if (!policy) return true;
  return policy.channels[channel]?.enabled !== false;
}

export function isEventChannelEnabled(
  policy: NotificationPolicy | null | undefined,
  event: NotificationPolicyEvent,
  channel: NotificationPolicyChannel,
): boolean {
  if (!policy) return true;
  const eventPolicy = policy.events[event];
  if (!eventPolicy) return true;
  return (
    eventPolicy.enabled !== false && eventPolicy.channels[channel] !== false
  );
}

export function resolveChannelCode(
  policy: NotificationPolicy | null | undefined,
  channel: NotificationPolicyChannel,
  fallbackCode: string,
): string {
  const code = policy?.channels[channel]?.code;
  return typeof code === 'string' && code.trim() ? code.trim() : fallbackCode;
}

export function resolveFallbackChannel(
  policy: NotificationPolicy | null | undefined,
  channel: NotificationPolicyChannel,
): NotificationPolicyChannel | null {
  const fallback = policy?.channels[channel]?.fallbackChannel;
  if (!isChannel(fallback) || fallback === channel) return null;
  return fallback;
}

/** Fetches the RxSoft org notification policy with a short in-process cache. */
@Injectable()
export class NotificationPolicyClient {
  private readonly logger = new Logger(NotificationPolicyClient.name);
  private readonly cache = new Map<
    string,
    { value: NotificationPolicy | null; expiry: number }
  >();
  private readonly ttl = 60_000;

  constructor(private readonly config: ConfigService) {}

  async get(
    organizationId?: string | null,
  ): Promise<NotificationPolicy | null> {
    if (!organizationId) return null;

    const cached = this.cache.get(organizationId);
    if (cached && cached.expiry > Date.now()) return cached.value;

    try {
      const baseUrl = this.config.get<string>(
        'RXSOFT_API_URL',
        'http://localhost:8080/api',
      );
      const apiKey = this.config.get<string>('INTERNAL_API_KEY', '');
      const response = await axios.get<{ notificationPolicy?: unknown }>(
        `${baseUrl.replace(/\/+$/, '')}/organisation-config/by-organization/${organizationId}`,
        {
          headers: apiKey ? { 'x-api-key': apiKey } : undefined,
          timeout: 5_000,
        },
      );
      const raw = response.data?.notificationPolicy;
      const value =
        raw && typeof raw === 'object'
          ? normalizeNotificationPolicy(raw)
          : null;
      this.cache.set(organizationId, { value, expiry: Date.now() + this.ttl });
      return value;
    } catch (error: unknown) {
      this.logger.warn(
        `Could not load notification policy for ${organizationId}: ${(error as Error)?.message ?? error}`,
      );
      return null;
    }
  }
}
