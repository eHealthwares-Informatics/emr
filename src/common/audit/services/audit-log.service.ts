import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogOrmEntity } from '../entities/audit-log.orm-entity';

export type AuditLogEntry = {
  organizationId: string | null;
  actorUserId: string | null;
  actorUsername: string | null;
  action: string;
  httpMethod: string | null;
  httpPath: string | null;
  statusCode: number | null;
  durationMs: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
};

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLogOrmEntity)
    private readonly repo: Repository<AuditLogOrmEntity>,
  ) {}

  async record(entry: AuditLogEntry): Promise<AuditLogOrmEntity> {
    const entity = this.repo.create({ ...entry } as Partial<AuditLogOrmEntity>);
    return this.repo.save(entity);
  }

  async list(query: {
    organizationId?: string | null;
    limit?: number;
    offset?: number;
  }) {
    const qb = this.repo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (query.organizationId) {
      qb.where('log.organization_id = :organizationId', {
        organizationId: query.organizationId,
      });
    }

    qb.skip(query.offset ?? 0).take(query.limit ?? 50);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
