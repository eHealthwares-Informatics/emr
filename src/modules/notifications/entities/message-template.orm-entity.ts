import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type {
  MessageContentType,
  MessageDestination,
  MessageTemplateStatus,
} from '../../../shared/domain/enums';

@Entity('message_templates')
export class MessageTemplateOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'content_type', type: 'text', default: 'free_text' })
  contentType!: MessageContentType;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'max_characters', type: 'int', nullable: true })
  maxCharacters!: number | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  destinations!: MessageDestination[];

  @Column({
    name: 'channel_codes',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  channelCodes!: string[];

  @Column({ name: 'heartbeat_retries', type: 'int', default: 3 })
  heartbeatRetries!: number;

  @Column({ name: 'heartbeat_interval_seconds', type: 'int', default: 30 })
  heartbeatIntervalSeconds!: number;

  @Column({ name: 'heartbeat_expiry_seconds', type: 'int', default: 86400 })
  heartbeatExpirySeconds!: number;

  @Column({ type: 'text', default: 'draft' })
  status!: MessageTemplateStatus;
}
