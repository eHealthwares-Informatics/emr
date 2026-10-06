import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationOrmEntity } from './notification.orm-entity';

/**
 * Per-user delivery + read state for a notification.
 *
 * Heartbeat retry model (Phase 1 in-app):
 * - `delivered` is set true when the in-app recipient row is materialised,
 *   because in-app delivery is effectively synchronous (the row itself is the
 *   delivery). `deliveredAt` records when.
 * - `retryCount` / `lastAttemptAt` / `nextRetryAt` are maintained by
 *   `NotificationsService.processRetries()` for recipients that are still
 *   undelivered (e.g. future non-in-app destinations or a failed delivery).
 * - `abandoned` is set once `heartbeatRetries` is exhausted or the
 *   `heartbeatExpirySeconds` window (measured from notification creation)
 *   elapses.
 */
@Entity('notification_recipients')
export class NotificationRecipientOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId!: string;

  @ManyToOne(
    () => NotificationOrmEntity,
    (notification) => notification.recipients,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'notification_id' })
  notification!: NotificationOrmEntity;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'boolean', default: false })
  read!: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  delivered!: boolean;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true })
  lastAttemptAt!: Date | null;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  abandoned!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
