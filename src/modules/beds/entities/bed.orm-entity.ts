import { Column, Entity } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { BedStatus, BedType } from '../../../shared/domain/enums';

@Entity('beds')
export class BedOrmEntity extends EmrBaseEntity {
  @Column({ type: 'text' })
  code!: string;

  @Column({ name: 'ward_id', type: 'uuid' })
  wardId!: string;

  @Column({ name: 'bed_type', type: 'text', default: 'STANDARD' })
  bedType!: BedType;

  @Column({ type: 'text', default: 'AVAILABLE' })
  status!: BedStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
