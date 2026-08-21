import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { StaffCategory, StaffRoleType } from '../../../shared/domain/enums';

@Entity('staff')
export class StaffOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'staff_number', type: 'text' })
  staffNumber!: string;

  @Column({ name: 'first_name', type: 'text' })
  firstName!: string;

  @Column({ name: 'last_name', type: 'text' })
  lastName!: string;

  @Column({ name: 'other_names', type: 'text', nullable: true })
  otherNames!: string | null;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ name: 'hire_date', type: 'date', nullable: true })
  hireDate!: string | null;

  @Column({ name: 'role_type', type: 'text' })
  roleType!: StaffRoleType;

  @Column({ type: 'text', nullable: true })
  category!: StaffCategory | null;

  @Column({ type: 'text', nullable: true })
  department!: string | null;

  // Location in the identity service (kept separate from the EMR base location).
  @Column({ name: 'identity_location_id', type: 'text', nullable: true })
  identityLocationId!: string | null;

  // Attached identity-service user (the staff member's login). Staff data is
  // not duplicated: this links to the identity user record instead.
  @Column({ name: 'user_id', type: 'text', nullable: true })
  userId!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'other_details', type: 'simple-json', nullable: true })
  otherDetails!: Record<string, unknown> | null;
}
