import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';

@Entity('tags')
@Index(['organization_id', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class TagOrmEntity extends EmrBaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  color!: string | null;
}
