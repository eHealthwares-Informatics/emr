import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WardOrmEntity } from '../entities/ward.orm-entity';
import { CreateWardDto, UpdateWardDto } from '../dto/ward.dto';
import { TenantContext } from '../../../common/tenant-context';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort, dslFilterValue } from '../../../database/list';

const SORT_ALLOW_LIST = ['code', 'name', 'wardType', 'createdAt', 'updatedAt'];

@Injectable()
export class WardsService {
  constructor(
    @InjectRepository(WardOrmEntity)
    private readonly repo: Repository<WardOrmEntity>,
  ) {}

  async list(
    query: ListQueryDto & {
      departmentId?: string;
      wardType?: string;
      isActive?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('ward')
      .where('ward.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(ward.organization_id = :orgId OR ward.organization_id IS NULL)',
        {
          orgId: tenant.organizationId,
        },
      );
    }

    if (query.search) {
      qb.andWhere('(ward.name ILIKE :search OR ward.code ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    const departmentId = dslFilterValue(query.departmentId);
    if (departmentId) {
      qb.andWhere('ward.department_id = :departmentId', { departmentId });
    }
    const wardType = dslFilterValue(query.wardType);
    if (wardType) {
      qb.andWhere('ward.ward_type = :wardType', { wardType });
    }
    if (query.isActive !== undefined) {
      const active = dslFilterValue(query.isActive);
      if (active !== undefined) {
        qb.andWhere('ward.is_active = :isActive', {
          isActive: active === 'true',
        });
      }
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    applySort(qb, 'ward', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();
    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  async create(dto: CreateWardDto, tenant: TenantContext) {
    await this.assertCodeAvailable(dto.code, tenant);
    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      wardType: dto.wardType ?? 'GENERAL',
      departmentId: dto.departmentId ?? null,
      departmentType: dto.departmentType ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateWardDto, tenant: TenantContext) {
    const ward = await this.findOneScoped(id, tenant);
    if (dto.code && dto.code !== ward.code) {
      await this.assertCodeAvailable(dto.code, tenant, id);
    }
    Object.assign(ward, dto);
    return this.repo.save(ward);
  }

  async remove(id: string, tenant: TenantContext) {
    const ward = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(ward);
    return { ok: true };
  }

  private async assertCodeAvailable(
    code: string,
    tenant: TenantContext,
    excludeId?: string,
  ) {
    const qb = this.repo
      .createQueryBuilder('ward')
      .where('ward.code = :code', { code })
      .andWhere('ward.deleted_at IS NULL');
    if (tenant.organizationId) {
      qb.andWhere('ward.organization_id = :orgId', {
        orgId: tenant.organizationId,
      });
    }
    if (excludeId) {
      qb.andWhere('ward.id != :excludeId', { excludeId });
    }
    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException('Ward code already exists');
    }
  }

  async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('ward')
      .where('ward.id = :id', { id })
      .andWhere('ward.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(ward.organization_id = :orgId OR ward.organization_id IS NULL)',
        {
          orgId: tenant.organizationId,
        },
      );
    }

    const ward = await qb.getOne();
    if (!ward) {
      throw new NotFoundException('Ward not found');
    }
    return ward;
  }
}
