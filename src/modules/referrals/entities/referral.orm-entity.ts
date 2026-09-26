import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';

export const REFERRAL_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'COMPLETED',
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REFERRAL_PRIORITIES = ['ROUTINE', 'URGENT'] as const;
export type ReferralPriority = (typeof REFERRAL_PRIORITIES)[number];

/**
 * A specialist referral, always tied to the encounter that prompted it.
 * The referring clinician creates it (outgoing for them); the addressed
 * specialist works it (incoming for them).
 */
@Entity('referrals')
@Index(['referringProviderId', 'specialistProviderId'])
export class ReferralOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'referral_number', type: 'text' })
  referralNumber!: string;

  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'text', nullable: true })
  patientName!: string | null;

  /** The encounter that prompted the referral. */
  @Column({ name: 'encounter_id', type: 'text' })
  encounterId!: string;

  @Column({ name: 'visit_id', type: 'text', nullable: true })
  visitId!: string | null;

  /** Staff id of the referring clinician. */
  @Column({ name: 'referring_provider_id', type: 'text' })
  referringProviderId!: string;

  @Column({ name: 'referring_provider_name', type: 'text', nullable: true })
  referringProviderName!: string | null;

  /** Staff id of the addressed specialist. */
  @Column({ name: 'specialist_provider_id', type: 'text' })
  specialistProviderId!: string;

  @Column({ name: 'specialist_provider_name', type: 'text', nullable: true })
  specialistProviderName!: string | null;

  @Column({ name: 'specialty', type: 'text', nullable: true })
  specialty!: string | null;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'text' })
  priority!: ReferralPriority;

  @Column({ type: 'text' })
  status!: ReferralStatus;

  @Column({ name: 'decision_reason', type: 'text', nullable: true })
  decisionReason!: string | null;

  @Column({ name: 'decision_at', type: 'timestamptz', nullable: true })
  decisionAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'created_by_id', type: 'text', nullable: true })
  createdById!: string | null;
}
