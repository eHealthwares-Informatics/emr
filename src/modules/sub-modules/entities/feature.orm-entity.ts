import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { EncounterType } from '../../../shared/domain/enums';
import { FormDefinitionOrmEntity } from '../../forms/entities/form-definition.orm-entity';
import { SubModuleOrmEntity } from './sub-module.orm-entity';

/**
 * A Feature is a form definition plus its runtime configuration: it is the
 * menu item under a SubModule and its CRUD page is the form's submissions
 * list. Access is granted by identity role codes (menu-only enforcement).
 */
@Entity('features')
@Index(['subModuleId', 'formDefinitionId'], { unique: true })
export class FeatureOrmEntity extends EmrBaseEntity {
  @Index()
  @Column({ name: 'sub_module_id', type: 'uuid' })
  subModuleId!: string;

  @ManyToOne(() => SubModuleOrmEntity, (subModule) => subModule.features, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sub_module_id' })
  subModule?: SubModuleOrmEntity;

  @Index()
  @Column({ name: 'form_definition_id', type: 'uuid' })
  formDefinitionId!: string;

  @ManyToOne(() => FormDefinitionOrmEntity, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'form_definition_id' })
  form?: FormDefinitionOrmEntity;

  /** Encounter type created when a session starts for this feature. */
  @Column({ name: 'encounter_type', type: 'text', default: 'CONSULTATION' })
  encounterType!: EncounterType;

  /**
   * Identity role codes allowed to see this feature in the menu. An empty
   * array means every EMR user sees it; `super_admin` always sees it.
   */
  @Column({ name: 'role_codes', type: 'simple-json', default: '[]' })
  roleCodes!: string[];

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
