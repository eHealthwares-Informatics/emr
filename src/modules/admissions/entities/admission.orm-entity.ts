import { Column, Entity } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type {
  AdmissionStatus,
  AdmissionType,
  DischargeType,
} from '../../../shared/domain/enums';

@Entity('admissions')
export class AdmissionOrmEntity extends EmrBaseEntity {
  @Column({ name: 'admission_number', type: 'text' })
  admissionNumber!: string;

  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'text' })
  patientName!: string;

  @Column({ name: 'ward_id', type: 'uuid', nullable: true })
  wardId!: string | null;

  @Column({ name: 'bed_id', type: 'uuid', nullable: true })
  bedId!: string | null;

  @Column({ name: 'admission_datetime', type: 'timestamptz' })
  admissionDatetime!: Date;

  @Column({ name: 'admission_type', type: 'text', default: 'ELECTIVE' })
  admissionType!: AdmissionType;

  @Column({ type: 'text', nullable: true })
  diagnosis!: string | null;

  @Column({ name: 'referring_provider_id', type: 'text', nullable: true })
  referringProviderId!: string | null;

  @Column({ name: 'referring_provider_name', type: 'text', nullable: true })
  referringProviderName!: string | null;

  @Column({ type: 'text', default: 'ADMITTED' })
  status!: AdmissionStatus;

  @Column({ name: 'discharge_datetime', type: 'timestamptz', nullable: true })
  dischargeDatetime!: Date | null;

  @Column({ name: 'discharge_type', type: 'text', nullable: true })
  dischargeType!: DischargeType | null;

  @Column({ name: 'discharge_summary', type: 'text', nullable: true })
  dischargeSummary!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by_id', type: 'text', nullable: true })
  createdById!: string | null;
}
