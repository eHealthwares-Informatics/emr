import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';

/** One-time SMS OTP used to verify a patient before binding them to a form. */
@Entity('patient_otp_challenges')
export class PatientOtpChallengeOrmEntity extends EmrBaseEntity {
  @Index()
  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ type: 'text' })
  phone!: string;

  @Column({ name: 'code_hash', type: 'text' })
  codeHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @Column({ name: 'share_link_id', type: 'uuid', nullable: true })
  shareLinkId!: string | null;

  @Column({ name: 'requested_by_id', type: 'text', nullable: true })
  requestedById!: string | null;
}
