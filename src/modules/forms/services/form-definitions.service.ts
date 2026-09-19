import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FormDefinitionOrmEntity } from '../entities/form-definition.orm-entity';
import {
  CreateFormDefinitionDto,
  UpdateFormDefinitionDto,
} from '../dto/form.dto';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';
import { validateFormSchema } from './schema-validator';

const SORT_ALLOW_LIST = [
  'code',
  'name',
  'category',
  'version',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class FormDefinitionsService {
  constructor(
    @InjectRepository(FormDefinitionOrmEntity)
    private readonly repo: Repository<FormDefinitionOrmEntity>,
  ) {}

  async list(
    query: ListQueryDto & { category?: string; published?: string },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('form')
      .where('form.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(form.organization_id = :orgId OR form.organization_id IS NULL)',
        {
          orgId: tenant.organizationId,
        },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(form.name ILIKE :search OR form.code ILIKE :search OR form.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.category) {
      qb.andWhere('form.category = :category', { category: query.category });
    }
    if (query.published) {
      qb.andWhere('form.is_published = :published', {
        published: query.published === 'true',
      });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    applySort(qb, 'form', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();
    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  async getByCode(code: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('form')
      .where('form.code = :code', { code })
      .andWhere('form.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(form.organization_id = :orgId OR form.organization_id IS NULL)',
        {
          orgId: tenant.organizationId,
        },
      );
    }

    const form = await qb.getOne();
    if (!form) {
      throw new NotFoundException('Form definition not found');
    }
    return form;
  }

  async create(
    dto: CreateFormDefinitionDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const existing = await this.repo.findOne({
      where: { code: dto.code, deletedAt: IsNull() },
    });
    if (existing) {
      throw new BadRequestException(
        `Form definition with code ${dto.code} already exists`,
      );
    }

    const errors = validateFormSchema(dto.schemaJson);
    if (errors.length > 0) {
      throw new BadRequestException(
        `Invalid form schema: ${errors.join('; ')}`,
      );
    }

    const entity = this.repo.create({
      ...dto,
      version: dto.version ?? 1,
      isPublished: false,
      publishedVersion: null,
      isActive: true,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      createdById: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateFormDefinitionDto,
    tenant: TenantContext,
  ) {
    const form = await this.findOneScoped(id, tenant);

    if (dto.schemaJson) {
      const errors = validateFormSchema(dto.schemaJson);
      if (errors.length > 0) {
        throw new BadRequestException(
          `Invalid form schema: ${errors.join('; ')}`,
        );
      }
      form.schemaJson = dto.schemaJson;
      form.version = (dto.version ?? form.version) + 1;
    }

    if (dto.name !== undefined) form.name = dto.name;
    if (dto.description !== undefined) form.description = dto.description;
    if (dto.category !== undefined) form.category = dto.category;

    return this.repo.save(form);
  }

  async publish(id: string, tenant: TenantContext) {
    const form = await this.findOneScoped(id, tenant);
    if (form.schemaJson?.fields?.length === 0) {
      throw new BadRequestException('Cannot publish a form with no fields');
    }
    form.isPublished = true;
    form.publishedVersion = form.version;
    return this.repo.save(form);
  }

  async unpublish(id: string, tenant: TenantContext) {
    const form = await this.findOneScoped(id, tenant);
    form.isPublished = false;
    form.publishedVersion = null;
    return this.repo.save(form);
  }

  async remove(id: string, tenant: TenantContext) {
    const form = await this.findOneScoped(id, tenant);
    if (form.isPublished) {
      throw new BadRequestException(
        'Published forms cannot be deleted; unpublish first',
      );
    }
    await this.repo.softRemove(form);
    return { ok: true };
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('form')
      .where('form.id = :id', { id })
      .andWhere('form.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(form.organization_id = :orgId OR form.organization_id IS NULL)',
        {
          orgId: tenant.organizationId,
        },
      );
    }

    const form = await qb.getOne();
    if (!form) {
      throw new NotFoundException('Form definition not found');
    }
    return form;
  }
}
