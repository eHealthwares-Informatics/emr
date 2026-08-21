import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { RequestStatus } from '../../../shared/domain/enums';

@Entity('request_status_history')
export class RequestStatusHistoryOrmEntity extends EmrBaseEntity {
  @Index()
  @Column({ name: 'request_id', type: 'text' })
  requestId!: string;

  @Column({ name: 'from_status', type: 'text', nullable: true })
  fromStatus!: string | null;

  // Null when the entry is a free-text note rather than a status transition.
  @Column({ name: 'to_status', type: 'text', nullable: true })
  toStatus!: RequestStatus | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'actor_user_id', type: 'text', nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'actor_username', type: 'text', nullable: true })
  actorUsername!: string | null;
}
