import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';

@Entity('visit_comments')
@Index(['visitId'])
export class VisitCommentOrmEntity extends EmrBaseEntity {
  @Column({ name: 'visit_id', type: 'uuid' })
  visitId!: string;

  @Column({ type: 'text' })
  comment!: string;

  @Column({ name: 'author_name', type: 'text', nullable: true })
  authorName!: string | null;

  @Column({ name: 'created_by_id', type: 'text', nullable: true })
  createdById!: string | null;
}
