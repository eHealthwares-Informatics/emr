import { Column, Entity } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { WardType } from '../../../shared/domain/enums';

@Entity('wards')
export class WardOrmEntity extends EmrBaseEntity {
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'ward_type', type: 'text', default: 'GENERAL' })
  wardType!: WardType;

  @Column({ name: 'department_id', type: 'text', nullable: true })
  departmentId!: string | null;

  @Column({ name: 'department_type', type: 'text', nullable: true })
  departmentType!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
