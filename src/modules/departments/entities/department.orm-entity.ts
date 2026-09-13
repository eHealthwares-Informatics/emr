import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { DepartmentType } from '../../../shared/domain/enums';

// A functional department (pharmacy, laboratory, OPD, wards…) that belongs to
// an identity-service site. `locationId` (inherited) references the identity
// location the department is physically at.
@Entity('departments')
export class DepartmentOrmEntity extends EmrBaseEntity {
  @Index()
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'department_type', type: 'text' })
  departmentType!: DepartmentType;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}