import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { FormDefinitionOrmEntity } from '../../forms/entities/form-definition.orm-entity';
import { FeatureOrmEntity } from '../entities/feature.orm-entity';
import { SubModuleOrmEntity } from '../entities/sub-module.orm-entity';
import { CreateFeatureDto, UpdateFeatureDto } from '../dto/feature.dto';

const SORT_ALLOW_LIST = ['sortOrder', 'encounterType', 'createdAt', 'updatedAt'];

@Injectable()
export class FeaturesService {
  constructor(
    @InjectRepository(FeatureOrmEntity)
    private readonly repo: Repository<FeatureOrmEntity>,
    @InjectRepository(SubModuleOrmEntity)
    private readonly subModuleRepo: Repository<SubModuleOrmEntity>,
    @InjectRepository(FormDefinitionOrmEntity)
    private readonly formRepo: Repository<FormDefinitionOrmEntity>,
  ) {}

  async list(
    query: ListQueryDto & { subModuleId?: string; isActive?: string },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('feature')
      .leftJoinAndSelect('feature.form', 'form', 'form.deleted_at IS NULL')
      .leftJoinAndSelect(
        'feature.subModule',
        'subModule',
        'subModule.deleted_at IS NULL',
      )
      .where('feature.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(feature.organization_id = :orgId OR feature.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.subModuleId) {
      qb.andWhere('feature.sub_module_id = :subModuleId', {
        subModuleId: query.subModuleId,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('feature.is_active = :isActive', {
        isActive: query.isActive === 'true',
      });
    }
    if (query.search) {
      qb.andWhere(
        '(form.name ILIKE :search OR form.code ILIKE :search OR subModule.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'sortOrder';
    applySort(qb, 'feature', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('feature')
      .leftJoinAndSelect('feature.form', 'form', 'form.deleted_at IS NULL')
      .leftJoinAndSelect(
        'feature.subModule',
        'subModule',
        'subModule.deleted_at IS NULL',
      )
      .where('feature.id = :id', { id })
      .andWhere('feature.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(feature.organization_id = :orgId OR feature.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const feature = await qb.getOne();
    if (!feature) {
      throw new NotFoundException('Feature not found');
    }
    return feature;
  }

  async create(
    dto: CreateFeatureDto,
    tenant: TenantContext,
    _user: RequestUser,
  ) {
    await this.assertSubModule(dto.subModuleId, tenant);
    await this.assertForm(dto.formDefinitionId, tenant);
    await this.assertFormNotAlreadyFeatured(
      dto.subModuleId,
      dto.formDefinitionId,
      tenant,
    );

    const entity = this.repo.create({
      subModuleId: dto.subModuleId,
      formDefinitionId: dto.formDefinitionId,
      encounterType: dto.encounterType ?? 'CONSULTATION',
      roleCodes: dto.roleCodes ?? [],
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateFeatureDto, tenant: TenantContext) {
    const feature = await this.get(id, tenant);

    if (
      dto.formDefinitionId &&
      dto.formDefinitionId !== feature.formDefinitionId
    ) {
      await this.assertForm(dto.formDefinitionId, tenant);
      await this.assertFormNotAlreadyFeatured(
        feature.subModuleId,
        dto.formDefinitionId,
        tenant,
        id,
      );
    }

    Object.assign(feature, dto);
    return this.repo.save(feature);
  }

  async remove(id: string, tenant: TenantContext) {
    const feature = await this.get(id, tenant);
    await this.repo.softRemove(feature);
    return { ok: true };
  }

  private async assertSubModule(subModuleId: string, tenant: TenantContext) {
    const qb = this.subModuleRepo
      .createQueryBuilder('sub')
      .where('sub.id = :subModuleId', { subModuleId })
      .andWhere('sub.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(sub.organization_id = :orgId OR sub.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const subModule = await qb.getOne();
    if (!subModule) {
      throw new NotFoundException('SubModule not found');
    }
    return subModule;
  }

  private async assertForm(formDefinitionId: string, tenant: TenantContext) {
    const qb = this.formRepo
      .createQueryBuilder('form')
      .where('form.id = :formDefinitionId', { formDefinitionId })
      .andWhere('form.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(form.organization_id = :orgId OR form.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const form = await qb.getOne();
    if (!form) {
      throw new NotFoundException('Form definition not found');
    }
    return form;
  }

  private async assertFormNotAlreadyFeatured(
    subModuleId: string,
    formDefinitionId: string,
    tenant: TenantContext,
    excludeId?: string,
  ) {
    const qb = this.repo
      .createQueryBuilder('feature')
      .where('feature.sub_module_id = :subModuleId', { subModuleId })
      .andWhere('feature.form_definition_id = :formDefinitionId', {
        formDefinitionId,
      })
      .andWhere('feature.deleted_at IS NULL');

    if (excludeId) {
      qb.andWhere('feature.id <> :excludeId', { excludeId });
    }
    if (tenant.organizationId) {
      qb.andWhere(
        '(feature.organization_id = :orgId OR feature.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException(
        'This form is already a feature of this SubModule',
      );
    }
  }
}
