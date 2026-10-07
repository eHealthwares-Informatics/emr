import { Column, Entity, OneToMany } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import { NotificationRecipientOrmEntity } from './notification-recipient.orm-entity';
import type { NotificationType } from '../../../shared/domain/enums';

@Entity('notifications')
export class NotificationOrmEntity extends EmrBaseEntity {
  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'text', default: 'info' })
  type!: NotificationType;

  @Column({ name: 'source_entity_type', type: 'text' })
  sourceEntityType!: string;

  @Column({ name: 'source_entity_id', type: 'uuid' })
  sourceEntityId!: string;

  @Column({ name: 'source_entity_ref', type: 'text', nullable: true })
  sourceEntityRef!: string | null;

  @OneToMany(
    () => NotificationRecipientOrmEntity,
    (recipient) => recipient.notification,
    {
      cascade: true,
    },
  )
  recipients!: NotificationRecipientOrmEntity[];
}
