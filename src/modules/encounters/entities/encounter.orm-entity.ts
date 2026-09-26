import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { EncounterStatus, EncounterType } from '../../../shared/domain/enums';

@Entity('encounters')
export class EncounterOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'encounter_number', type: 'text' })
  encounterNumber!: string;

  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ name: 'visit_id', type: 'text', nullable: true })
  visitId!: string | null;

  @Column({ name: 'encounter_type', type: 'text' })
  encounterType!: EncounterType;

  @Column({ type: 'text', default: 'ACTIVE' })
  status!: EncounterStatus;

  @Column({ name: 'provider_id', type: 'text', nullable: true })
  providerId!: string | null;

  @Column({ name: 'provider_name', type: 'text', nullable: true })
  providerName!: string | null;

  @Column({ name: 'encounter_datetime', type: 'timestamptz' })
  encounterDatetime!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by_id', type: 'text', nullable: true })
  createdById!: string | null;
}
