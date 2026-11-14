import { Column, Entity, Index, OneToMany } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import { RequestItemOrmEntity } from './request-item.orm-entity';
import type {
  RequestStatus,
  RequestType,
  SyncStatus,
  Priority,
  PharmacySyncTarget,
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

  /** Published REQUEST form this request was captured with. */
  @Column({ name: 'form_definition_id', type: 'text', nullable: true })
  formDefinitionId!: string | null;

  /**
   * Raw answers from that form. Items are derived from them at capture time;
   * the payload is kept for printing and audit.
   */
  @Column({ name: 'form_data', type: 'simple-json', nullable: true })
  formData!: Record<string, unknown> | null;

  @Column({ name: 'external_order_id', type: 'text', nullable: true })
  externalOrderId!: string | null;

  @Column({ name: 'external_reference', type: 'text', nullable: true })
  externalReference!: string | null;

  @Column({ name: 'sync_status', type: 'text', default: 'NONE' })
  syncStatus!: SyncStatus;

  /**
   * Where this request is sent in rxsoft when it is a PRESCRIPTION.
   * Null falls back to the EMR_PHARMACY_SYNC_MODE setting.
   */
  @Column({ name: 'pharmacy_sync_target', type: 'text', nullable: true })
  pharmacySyncTarget!: PharmacySyncTarget | null;

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
