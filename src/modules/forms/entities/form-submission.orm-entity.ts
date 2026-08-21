import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { FormSubmissionStatus } from '../../../shared/domain/emr.types';

@Entity('form_submissions')
export class FormSubmissionOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'submission_number', type: 'text' })
  submissionNumber!: string;

  @Column({ name: 'form_definition_id', type: 'text' })
  formDefinitionId!: string;

  @Column({ name: 'form_name', type: 'text' })
  formName!: string;

  @Column({ name: 'form_version', type: 'int' })
  formVersion!: number;

  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ name: 'visit_id', type: 'text', nullable: true })
  visitId!: string | null;

  @Column({ name: 'encounter_id', type: 'text', nullable: true })
  encounterId!: string | null;

  @Column({ name: 'data_json', type: 'simple-json' })
  dataJson!: Record<string, unknown>;

  @Column({ type: 'text', default: 'SUBMITTED' })
  status!: FormSubmissionStatus;

  @Column({ name: 'submitted_by_id', type: 'text', nullable: true })
  submittedById!: string | null;

  @Column({ name: 'submitted_by_name', type: 'text', nullable: true })
  submittedByName!: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'amended_from_id', type: 'text', nullable: true })
  amendedFromId!: string | null;
}
