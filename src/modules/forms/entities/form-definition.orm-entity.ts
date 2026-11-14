import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { FormSchema } from '../../../shared/domain/emr.types';
import type { FormCategory, RequestType } from '../../../shared/domain/enums';

@Entity('form_definitions')
export class FormDefinitionOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'text' })
  category!: FormCategory;

  /**
   * Request type this form fulfils (REQUEST category only). Requests render the
   * published form whose requestType matches the type being created.
   */
  @Index('idx_form_definitions_request_type', ['requestType'])
  @Column({ name: 'request_type', type: 'text', nullable: true })
  requestType!: RequestType | null;

  @Column({ name: 'schema_json', type: 'simple-json' })
  schemaJson!: FormSchema;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished!: boolean;

  @Column({ name: 'published_version', type: 'int', nullable: true })
  publishedVersion!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by_id', type: 'text', nullable: true })
  createdById!: string | null;
}
