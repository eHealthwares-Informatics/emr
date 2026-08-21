import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import { RequestOrmEntity } from './request.orm-entity';

@Entity('request_items')
export class RequestItemOrmEntity extends EmrBaseEntity {
  @Column({ name: 'request_id', type: 'text' })
  requestId!: string;

  @ManyToOne(() => RequestOrmEntity, (request) => request.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request!: RequestOrmEntity;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  code!: string | null;

  @Column({ type: 'text', nullable: true })
  dose!: string | null;

  @Column({ name: 'dose_unit', type: 'text', nullable: true })
  doseUnit!: string | null;

  @Column({ type: 'text', nullable: true })
  frequency!: string | null;

  @Column({ type: 'text', nullable: true })
  route!: string | null;

  @Column({ type: 'text', nullable: true })
  duration!: string | null;

  @Column({ name: 'duration_unit', type: 'text', nullable: true })
  durationUnit!: string | null;

  @Column({ type: 'int', nullable: true })
  quantity!: number | null;

  @Column({ type: 'text', nullable: true })
  instructions!: string | null;

  @Column({ name: 'test_definition_id', type: 'text', nullable: true })
  testDefinitionId!: string | null;

  @Column({ name: 'sample_type', type: 'text', nullable: true })
  sampleType!: string | null;

  @Column({ name: 'specimen_notes', type: 'text', nullable: true })
  specimenNotes!: string | null;

  @Column({ type: 'text', nullable: true })
  modality!: string | null;

  @Column({ name: 'body_part', type: 'text', nullable: true })
  bodyPart!: string | null;

  @Column({ type: 'boolean', default: false })
  contrast!: boolean;

  @Column({ name: 'clinical_indication', type: 'text', nullable: true })
  clinicalIndication!: string | null;

  @Column({ type: 'text', nullable: true })
  category!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
