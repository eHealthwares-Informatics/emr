import { Column, Entity, Index, OneToMany } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import { RequestItemOrmEntity } from './request-item.orm-entity';
import type {
  RequestStatus,
  RequestType,
  SyncStatus,
  Priority,
} from '../../../shared/domain/enums';

@Entity('requests')
export class RequestOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'request_number', type: 'text' })
  requestNumber!: string;

  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'text' })
  patientName!: string;

  @Column({ name: 'encounter_id', type: 'text', nullable: true })
  encounterId!: string | null;

  @Column({ name: 'visit_id', type: 'text', nullable: true })
  visitId!: string | null;

  @Column({ name: 'request_type', type: 'text' })
  requestType!: RequestType;

  @Column({ type: 'text', default: 'REQUESTED' })
  status!: RequestStatus;

  @Column({ type: 'text', default: 'ROUTINE' })
  priority!: Priority;

  @Column({ name: 'ordering_provider_id', type: 'text', nullable: true })
  orderingProviderId!: string | null;

  @Column({ name: 'ordering_provider_name', type: 'text', nullable: true })
  orderingProviderName!: string | null;

  @Column({ type: 'text', nullable: true })
  diagnosis!: string | null;

  @Column({ name: 'clinical_notes', type: 'text', nullable: true })
  clinicalNotes!: string | null;

  @Column({ name: 'external_order_id', type: 'text', nullable: true })
  externalOrderId!: string | null;

  @Column({ name: 'external_reference', type: 'text', nullable: true })
  externalReference!: string | null;

  @Column({ name: 'sync_status', type: 'text', default: 'NONE' })
  syncStatus!: SyncStatus;

  @Column({ name: 'sync_error', type: 'text', nullable: true })
  syncError!: string | null;

  @Column({ name: 'send_attempt_count', type: 'int', default: 0 })
  sendAttemptCount!: number;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'created_by_id', type: 'text', nullable: true })
  createdById!: string | null;

  @OneToMany(() => RequestItemOrmEntity, (item) => item.request, {
    cascade: true,
  })
  items!: RequestItemOrmEntity[];
}
