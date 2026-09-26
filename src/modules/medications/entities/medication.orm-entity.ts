import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';

export const MEDICATION_STATUSES = [
  'PRESCRIBED',
  'ADMINISTERED',
  'PARTIALLY_ADMINISTERED',
  'CANCELLED',
] as const;
export type MedicationStatus = (typeof MEDICATION_STATUSES)[number];

/**
 * A medication order created by a nurse from a PRESCRIPTION request (one
 * medication record per prescription item). Administration is recorded here
 * and mirrored back onto the originating request's status.
 */
@Entity('medications')
@Index(['requestId'])
export class MedicationOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'medication_number', type: 'text' })
  medicationNumber!: string;

  @Column({ name: 'request_id', type: 'text' })
  requestId!: string;

  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'text', nullable: true })
  patientName!: string | null;

  @Column({ name: 'encounter_id', type: 'text', nullable: true })
  encounterId!: string | null;

  @Column({ name: 'visit_id', type: 'text', nullable: true })
  visitId!: string | null;

  /** e.g. the prescription item name (drug). */
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  dose!: string | null;

  @Column({ name: 'dose_unit', type: 'text', nullable: true })
  doseUnit!: string | null;

  @Column({ type: 'text', nullable: true })
  route!: string | null;

  @Column({ type: 'text', nullable: true })
  frequency!: string | null;

  @Column({ type: 'text', nullable: true })
  duration!: string | null;

  @Column({ name: 'duration_unit', type: 'text', nullable: true })
  durationUnit!: string | null;

  @Column({ type: 'int', nullable: true })
  quantity!: number | null;

  @Column({ type: 'text', nullable: true })
  instructions!: string | null;

  @Column({ type: 'text' })
  status!: MedicationStatus;

  @Column({ name: 'administered_at', type: 'timestamptz', nullable: true })
  administeredAt!: Date | null;

  @Column({ name: 'administered_by_id', type: 'text', nullable: true })
  administeredById!: string | null;

  @Column({ name: 'administered_by_name', type: 'text', nullable: true })
  administeredByName!: string | null;

  @Column({ name: 'administration_notes', type: 'text', nullable: true })
  administrationNotes!: string | null;

  @Column({ name: 'created_by_id', type: 'text', nullable: true })
  createdById!: string | null;
}
