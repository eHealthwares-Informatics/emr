import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';

/** Where the dispatch originated inside EMR. */
export type NotificationDispatchSource =
  | 'notification_client'
  | 'external'
  | 'retrigger';

export type NotificationDispatchStatus =
  | 'PENDING'
  | 'SENT'
  | 'PARTIAL'
  | 'FAILED'
  | 'SKIPPED';

/**
 * Sender-app ledger: one row per notification EMR handed to the conversation
 * engine. Conversation owns templates, channels and its own delivery ledger;
 * EMR keeps this copy so the module can show what it sent and re-trigger it.
 *
 * `requestPayload` is the exact `NotificationEventDispatch` replay payload.
 */
@Entity('notification_dispatches')
export class NotificationDispatchOrmEntity extends EmrBaseEntity {
  @Index()
  @Column({ name: 'event_key', type: 'text' })
  eventKey!: string;

  /** Producer that emitted the event (usually `emr`). */
  @Column({ name: 'source_app', type: 'text', default: 'emr' })
  sourceApp!: string;

  @Column({ name: 'source', type: 'text', default: 'notification_client' })
  source!: NotificationDispatchSource;

  /** Display address (phone, email, or a comma-joined recipient list). */
  @Column({ name: 'recipient_address', type: 'text', nullable: true })
  recipientAddress!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  recipients!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  subject!: string | null;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Index()
  @Column({ type: 'text', default: 'PENDING' })
  status!: NotificationDispatchStatus;

  @Column({ name: 'sent_count', type: 'int', default: 0 })
  sentCount!: number;

  @Column({ name: 'failed_count', type: 'int', default: 0 })
  failedCount!: number;

  @Column({ name: 'skipped_count', type: 'int', default: 0 })
  skippedCount!: number;

  @Column({ type: 'jsonb', nullable: true })
  deliveries!: string[] | null;

  /** First conversation delivery id (when a channel accepted the send). */
  @Column({ name: 'exchange_id', type: 'text', nullable: true })
  exchangeId!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'related_entity_type', type: 'text', nullable: true })
  relatedEntityType!: string | null;

  @Column({ name: 'related_entity_id', type: 'text', nullable: true })
  relatedEntityId!: string | null;

  /** Exact event payload, replayed verbatim by a retrigger. */
  @Column({ name: 'request_payload', type: 'jsonb', nullable: true })
  requestPayload!: Record<string, unknown> | null;

  @Column({ name: 'retriggered_from_id', type: 'uuid', nullable: true })
  retriggeredFromId!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;
}
