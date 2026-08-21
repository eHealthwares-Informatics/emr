import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';

/**
 * User/role config table controlling which forms a user can open in
 * Documentation. A row with a null `formCode` grants (or denies) access to
 * every form; specific rows target one form by its code.
 */
@Entity('form_access')
export class FormAccessOrmEntity extends EmrBaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'text', nullable: true })
  userId!: string | null;

  @Index()
  @Column({ name: 'role_code', type: 'text', nullable: true })
  roleCode!: string | null;

  @Index()
  @Column({ name: 'form_code', type: 'text', nullable: true })
  formCode!: string | null;

  @Column({ name: 'is_allowed', type: 'boolean', default: true })
  isAllowed!: boolean;
}
