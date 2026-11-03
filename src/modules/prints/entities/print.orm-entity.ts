import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PRINT_STATUSES = ['pending', 'ready', 'failed'] as const;
export type PrintStatus = (typeof PRINT_STATUSES)[number];

/**
 * Cached generated document (PDF) for a business resource.
 *
 * The unique cache key is `resourceType:resourceId:printTemplateId:format`, so
 * a reprint reuses the same file until the resource/template changes. Local,
 * Cloudinary and S3 locations are all kept so a file can be served even when
 * one storage backend is unavailable.
 */
@Entity('prints')
@Index('uq_prints_org_cache_key', ['organizationId', 'cacheKey'], {
  unique: true,
})
export class PrintOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'resource_type', type: 'text' })
  resourceType!: string;

  @Column({ name: 'resource_id', type: 'text' })
  resourceId!: string;

  @Column({ name: 'print_template_id', type: 'text', nullable: true })
  printTemplateId!: string | null;

  @Column({ name: 'format', type: 'text', default: 'pdf' })
  format!: string;

  @Column({ name: 'cache_key', type: 'text' })
  cacheKey!: string;

  @Column({ name: 'file_name', type: 'text' })
  fileName!: string;

  @Column({ name: 'mime_type', type: 'text', default: 'application/pdf' })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'int', default: 0 })
  sizeBytes!: number;

  /** Path relative to PRINT_STORAGE_PATH (or an absolute path). */
  @Column({ name: 'local_path', type: 'text', nullable: true })
  localPath!: string | null;

  @Column({ name: 'cloudinary_url', type: 'text', nullable: true })
  cloudinaryUrl!: string | null;

  @Column({ name: 's3_url', type: 'text', nullable: true })
  s3Url!: string | null;

  @Column({
    name: 'cloudinary_uploaded_at',
    type: 'timestamptz',
    nullable: true,
  })
  cloudinaryUploadedAt!: Date | null;

  @Column({ name: 's3_uploaded_at', type: 'timestamptz', nullable: true })
  s3UploadedAt!: Date | null;

  @Column({ type: 'text', default: 'pending' })
  status!: PrintStatus;

  @Column({ name: 'checksum', type: 'text', nullable: true })
  checksum!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'error', type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
