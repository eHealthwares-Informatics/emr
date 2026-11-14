import { Column, Entity, Index, OneToMany } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import { FeatureOrmEntity } from './feature.orm-entity';

/**
 * A SubModule is a first-class EMR menu group (same level as the built-in
 * "Ward" group). Admins create them at runtime; their Features render as the
 * group's submenu items.
 */
@Entity('sub_modules')
export class SubModuleOrmEntity extends EmrBaseEntity {
  @Index()
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Lucide icon name resolved by the frontend; falls back to a default. */
  @Column({ type: 'text', nullable: true })
  icon!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => FeatureOrmEntity, (feature) => feature.subModule)
  features?: FeatureOrmEntity[];
}
