import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TagOrmEntity } from '../entities/tag.orm-entity';
import { PatientTagOrmEntity } from '../entities/patient-tag.orm-entity';
import { AssignPatientTagsDto, CreateTagDto, UpdateTagDto } from '../dto/tag.dto';
import { TenantContext } from '../../../common/tenant-context';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';

const SORT_ALLOW_LIST = ['name', 'createdAt', 'updatedAt'];

export type TagSummary = { id: string; name: string; color: string | null };

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(TagOrmEntity)
    private readonly repo: Repository<TagOrmEntity>,
    @InjectRepository(PatientTagOrmEntity)
    private readonly patientTagsRepo: Repository<PatientTagOrmEntity>,
  ) {}

  async list(
    query: ListQueryDto & { isActive?: string },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('tag')
      .where('tag.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(tag.organization_id = :orgId OR tag.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere('tag.name ILIKE :search', { search: `%${query.search}%` });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'name';
    applySort(qb, 'tag', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();
    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  async create(dto: CreateTagDto, tenant: TenantContext) {
    await this.assertNameAvailable(dto.name, tenant);
    const entity = this.repo.create({
      name: dto.name,
      color: dto.color ?? null,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateTagDto, tenant: TenantContext) {
    const tag = await this.findOneScoped(id, tenant);
    if (dto.name && dto.name !== tag.name) {
      await this.assertNameAvailable(dto.name, tenant, id);
    }
    Object.assign(tag, dto);
    return this.repo.save(tag);
  }

  async remove(id: string, tenant: TenantContext) {
    const tag = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(tag);
    // Drop the join rows so the deleted tag no longer shows on patients.
    await this.patientTagsRepo.delete({ tagId: id });
    return { ok: true };
  }

  /** Loads the tags attached to a set of patients, grouped by patient id. */
  async tagsForPatients(patientIds: string[]): Promise<Map<string, TagSummary[]>> {
    const result = new Map<string, TagSummary[]>();
    if (patientIds.length === 0) return result;

    const rows = await this.patientTagsRepo
      .createQueryBuilder('patientTag')
      .leftJoin(TagOrmEntity, 'tag', 'tag.id = patientTag.tag_id')
      .where('patientTag.patient_id IN (:...patientIds)', { patientIds })
      .andWhere('tag.deleted_at IS NULL')
      .select([
        'patientTag.patient_id AS "patientId"',
        'tag.id AS "id"',
        'tag.name AS "name"',
        'tag.color AS "color"',
      ])
      .orderBy('tag.name', 'ASC')
      .getRawMany<{
        patientId: string;
        id: string;
        name: string;
        color: string | null;
      }>();

    for (const row of rows) {
      const list = result.get(row.patientId) ?? [];
      list.push({ id: row.id, name: row.name, color: row.color });
      result.set(row.patientId, list);
    }
    return result;
  }

  /** Replaces a patient's tag set. Validates ids within the tenant. */
  async assignToPatient(
    patientId: string,
    dto: AssignPatientTagsDto,
    tenant: TenantContext,
  ) {
    const uniqueIds = [...new Set(dto.tagIds)];
    if (uniqueIds.length > 0) {
      const qb = this.repo
        .createQueryBuilder('tag')
        .where('tag.deleted_at IS NULL')
        .andWhere('tag.id IN (:...ids)', { ids: uniqueIds });
      if (tenant.organizationId) {
        qb.andWhere(
          '(tag.organization_id = :orgId OR tag.organization_id IS NULL)',
          { orgId: tenant.organizationId },
        );
      }
      const found = await qb.getMany();
      if (found.length !== uniqueIds.length) {
        throw new BadRequestException('One or more tags were not found');
      }
    }

    await this.patientTagsRepo.delete({ patientId });
    if (uniqueIds.length > 0) {
      const rows = this.patientTagsRepo.create(
        uniqueIds.map((tagId) => ({ patientId, tagId })),
      );
      await this.patientTagsRepo.save(rows);
    }
    const tags = await this.tagsForPatients([patientId]);
    return { patientId, tags: tags.get(patientId) ?? [] };
  }

  private async assertNameAvailable(
    name: string,
    tenant: TenantContext,
    excludeId?: string,
  ) {
    const qb = this.repo
      .createQueryBuilder('tag')
      .where('tag.name = :name', { name })
      .andWhere('tag.deleted_at IS NULL');
    if (tenant.organizationId) {
      qb.andWhere('tag.organization_id = :orgId', { orgId: tenant.organizationId });
    }
    if (excludeId) {
      qb.andWhere('tag.id != :excludeId', { excludeId });
    }
    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException(`Tag name "${name}" is already in use`);
    }
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('tag')
      .where('tag.id = :id', { id })
      .andWhere('tag.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(tag.organization_id = :orgId OR tag.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const tag = await qb.getOne();
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return tag;
  }
}
