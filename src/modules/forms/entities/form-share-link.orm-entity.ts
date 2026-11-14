import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';

export type FormShareMode = 'template' | 'instance';

/**
 * A public form link. `template` links open the form for any verified patient;
 * `instance` links are bound to an existing patient/submission and reopen the
 * current values.
 */
@Entity('form_share_links')
export class FormShareLinkOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  @Index()
  @Column({ name: 'form_definition_id', type: 'uuid' })
  formDefinitionId!: string;

  @Index()
  @Column({ name: 'patient_id', type: 'text', nullable: true })
  patientId!: string | null;

  @Index()
  @Column({ name: 'submission_id', type: 'uuid', nullable: true })
  submissionId!: string | null;

  @Column({ type: 'text', default: 'template' })
  mode!: FormShareMode;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'max_uses', type: 'int', nullable: true })
  maxUses!: number | null;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount!: number;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'created_by_id', type: 'text', nullable: true })
  createdById!: string | null;
}
