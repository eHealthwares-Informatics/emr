import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { VisitStatus, VisitType } from '../../../shared/domain/enums';

@Entity('visits')
export class VisitOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'visit_number', type: 'text' })
  visitNumber!: string;

  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'text' })
  patientName!: string;

  @Column({ name: 'visit_type', type: 'text' })
  visitType!: VisitType;

  @Column({ type: 'text', default: 'ONGOING' })
  status!: VisitStatus;

  @Column({ name: 'start_datetime', type: 'timestamptz' })
  startDatetime!: Date;

  @Column({ name: 'stop_datetime', type: 'timestamptz', nullable: true })
  stopDatetime!: Date | null;

  @Column({ name: 'provider_id', type: 'text', nullable: true })
  providerId!: string | null;

  @Column({ name: 'provider_name', type: 'text', nullable: true })
  providerName!: string | null;

  @Column({ name: 'appointment_id', type: 'text', nullable: true })
  appointmentId!: string | null;

  @Column({ name: 'created_by_id', type: 'text', nullable: true })
  createdById!: string | null;
}
