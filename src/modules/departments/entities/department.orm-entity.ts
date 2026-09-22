import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { DepartmentType } from '../../../shared/domain/enums';

// A functional department (pharmacy, laboratory, OPD, wards…) that belongs to
// an identity-service site. `locationId` (inherited) references the identity
// location the department is physically at. `parentId` optionally nests the
// department under another (parent → child hierarchy).
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

  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => DepartmentOrmEntity, (department) => department.children, {
    nullable: true,
    createForeignKeyConstraints: false,
  })
  parent?: DepartmentOrmEntity | null;

  @OneToMany(() => DepartmentOrmEntity, (department) => department.parent)
  children?: DepartmentOrmEntity[];
}
