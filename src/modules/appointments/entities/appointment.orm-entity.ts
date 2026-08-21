import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { AppointmentStatus, AppointmentType, Priority } from '../../../shared/domain/enums';

@Entity('appointments')
export class AppointmentOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'appointment_number', type: 'text' })
  appointmentNumber!: string;

  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'text' })
  patientName!: string;

  @Column({ name: 'appointment_type', type: 'text' })
  appointmentType!: AppointmentType;

  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'start_time', type: 'text' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'text', nullable: true })
  endTime!: string | null;

  @Column({ name: 'provider_id', type: 'text', nullable: true })
  providerId!: string | null;

  @Column({ name: 'provider_name', type: 'text', nullable: true })
  providerName!: string | null;

  @Column({ type: 'text', default: 'SCHEDULED' })
  status!: AppointmentStatus;

  @Column({ type: 'text', default: 'ROUTINE' })
  priority!: Priority;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'schedule_location', type: 'text', nullable: true })
  scheduleLocation!: string | null;

  @Column({ name: 'visit_id', type: 'text', nullable: true })
  visitId!: string | null;

  @Column({ name: 'created_by_id', type: 'text', nullable: true })
  createdById!: string | null;
}
