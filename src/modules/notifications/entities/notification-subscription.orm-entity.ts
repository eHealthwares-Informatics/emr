import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';

/**
 * A user's active notification session. The frontend registers (and heartbeats)
 * this on app mount/login. `organizationId`/`locationId` come from
 * `EmrBaseEntity`; both are nullable so a global admin (no tenant in the JWT)
 * subscribes with null org/location, which matches every request.
 */
@Entity('notification_subscriptions')
export class NotificationSubscriptionOrmEntity extends EmrBaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'last_heartbeat_at', type: 'timestamptz' })
  lastHeartbeatAt!: Date;
}
