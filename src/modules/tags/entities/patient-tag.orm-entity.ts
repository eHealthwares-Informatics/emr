import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';

/** Join table linking patients to tags (many-to-many). */
@Entity('patient_tags')
@Index(['patientId', 'tagId'], { unique: true })
export class PatientTagOrmEntity extends EmrBaseEntity {
  @Column({ name: 'patient_id', type: 'text' })
  patientId!: string;

  @Column({ name: 'tag_id', type: 'uuid' })
  tagId!: string;
}
