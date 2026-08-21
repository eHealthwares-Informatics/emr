import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { Identifier } from '../../../shared/domain/emr.types';

@Entity('patients')
export class PatientOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ name: 'first_name', type: 'text' })
  firstName!: string;

  @Column({ name: 'last_name', type: 'text' })
  lastName!: string;

  @Column({ name: 'other_names', type: 'text', nullable: true })
  otherNames!: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth!: string | null;

  @Column({ type: 'text', nullable: true })
  gender!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ name: 'next_of_kin_name', type: 'text', nullable: true })
  nextOfKinName!: string | null;

  @Column({ name: 'next_of_kin_phone', type: 'text', nullable: true })
  nextOfKinPhone!: string | null;

  @Column({ name: 'next_of_kin_relationship', type: 'text', nullable: true })
  nextOfKinRelationship!: string | null;

  @Column({ type: 'simple-json', default: [] })
  identifiers!: Identifier[];

  @Column({ name: 'marital_status', type: 'text', nullable: true })
  maritalStatus!: string | null;

  @Column({ type: 'text', nullable: true })
  occupation!: string | null;

  @Column({ name: 'blood_group', type: 'text', nullable: true })
  bloodGroup!: string | null;

  @Column({ type: 'text', nullable: true })
  genotype!: string | null;

  @Column({ name: 'payment_provider_ids', type: 'simple-json', default: [] })
  paymentProviderIds!: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
