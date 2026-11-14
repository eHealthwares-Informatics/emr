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
import { IdentityProxyService } from '../../identity-proxy/identity-proxy.service';
import { SubModuleOrmEntity } from '../entities/sub-module.orm-entity';
import { CreateSubModuleDto, UpdateSubModuleDto } from '../dto/sub-module.dto';

const SORT_ALLOW_LIST = ['code', 'name', 'sortOrder', 'createdAt', 'updatedAt'];

@Injectable()
export class SubModulesService {
  constructor(
    @InjectRepository(SubModuleOrmEntity)
    private readonly repo: Repository<SubModuleOrmEntity>,
    private readonly identityProxy: IdentityProxyService,
  ) {}

  async list(query: ListQueryDto, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('sub')
      .loadRelationCountAndMap(
        'sub.featureCount',
        'sub.features',
        'feature',
        (featureQb) => featureQb.andWhere('feature.is_active = true'),
      )
      .where('sub.deleted_at IS NULL');

    this.applyTenantScope(qb, tenant);

    if (query.search) {
      qb.andWhere(
        '(sub.name ILIKE :search OR sub.code ILIKE :search OR sub.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'sortOrder';
    applySort(qb, 'sub', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('sub')
      .leftJoinAndSelect(
        'sub.features',
        'feature',
        'feature.deleted_at IS NULL',
      )
      .leftJoinAndSelect('feature.form', 'form', 'form.deleted_at IS NULL')
      .where('sub.id = :id', { id })
      .andWhere('sub.deleted_at IS NULL')
      .orderBy('feature.sort_order', 'ASC')
      .addOrderBy('feature.created_at', 'ASC');

    this.applyTenantScope(qb, tenant);

    const subModule = await qb.getOne();
    if (!subModule) {
      throw new NotFoundException('SubModule not found');
    }
    return subModule;
  }

  /**
   * Menu tree consumed by the frontend sidebar. Only active submodules,
   * active features and published forms are returned; role filtering happens
   * client-side (menu-only enforcement).
   */
  async navigation(tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('sub')
      .leftJoinAndSelect(
        'sub.features',
        'feature',
        'feature.is_active = true AND feature.deleted_at IS NULL',
      )
      .leftJoinAndSelect(
        'feature.form',
        'form',
        'form.deleted_at IS NULL AND form.is_active = true AND form.is_published = true',
      )
      .where('sub.deleted_at IS NULL')
      .andWhere('sub.is_active = true')
      .orderBy('sub.sort_order', 'ASC')
      .addOrderBy('sub.name', 'ASC')
      .addOrderBy('feature.sort_order', 'ASC');

    this.applyTenantScope(qb, tenant);

    const subModules = await qb.getMany();

    return {
      data: subModules.map((sub) => ({
        id: sub.id,
        code: sub.code,
        name: sub.name,
        description: sub.description,
        icon: sub.icon,
        sortOrder: sub.sortOrder,
        features: (sub.features ?? [])
          .filter((feature) => feature.isActive && feature.form)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((feature) => ({
            id: feature.id,
            code: feature.form?.code,
            name: feature.form?.name,
            description: feature.form?.description ?? null,
            formDefinitionId: feature.formDefinitionId,
            encounterType: feature.encounterType,
            roleCodes: feature.roleCodes ?? [],
            sortOrder: feature.sortOrder,
          })),
      })),
    };
  }

  async roleOptions(token?: string, organizationId?: string | null) {
    return {
      data: await this.identityProxy.listRoles(token, organizationId),
    };
  }

  async create(
    dto: CreateSubModuleDto,
    tenant: TenantContext,
    _user: RequestUser,
  ) {
    await this.assertCodeAvailable(dto.code, tenant);

    const entity = this.repo.create({
      ...dto,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateSubModuleDto, tenant: TenantContext) {
    const subModule = await this.get(id, tenant);

    if (dto.code && dto.code !== subModule.code) {
      await this.assertCodeAvailable(dto.code, tenant, id);
    }

    Object.assign(subModule, dto);
    return this.repo.save(subModule);
  }

  async remove(id: string, tenant: TenantContext) {
    const subModule = await this.get(id, tenant);
    await this.repo.softRemove(subModule);
    return { ok: true };
  }

  private applyTenantScope(qb: any, tenant: TenantContext) {
    if (tenant.organizationId) {
      qb.andWhere(
        '(sub.organization_id = :orgId OR sub.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }
  }

  private async assertCodeAvailable(
    code: string,
    tenant: TenantContext,
    excludeId?: string,
  ) {
    const qb = this.repo
      .createQueryBuilder('sub')
      .where('sub.code = :code', { code })
      .andWhere('sub.deleted_at IS NULL');

    if (excludeId) {
      qb.andWhere('sub.id <> :excludeId', { excludeId });
    }
    if (tenant.organizationId) {
      qb.andWhere(
        '(sub.organization_id = :orgId OR sub.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException(
        `SubModule with code ${code} already exists`,
      );
    }
  }
}
