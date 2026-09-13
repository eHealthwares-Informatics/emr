import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentOrmEntity } from '../entities/department.orm-entity';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../dto/department.dto';
import { TenantContext } from '../../../common/tenant-context';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';

const SORT_ALLOW_LIST = ['code', 'name', 'departmentType', 'createdAt'];

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(DepartmentOrmEntity)
    private readonly repo: Repository<DepartmentOrmEntity>,
  ) {}

  async list(
    query: ListQueryDto & {
      locationId?: string;
      departmentType?: string;
      isActive?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo.createQueryBuilder('department').where('department.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(department.organization_id = :orgId OR department.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(department.name ILIKE :search OR department.code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.locationId) {
      qb.andWhere('department.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.departmentType) {
      qb.andWhere('department.department_type = :departmentType', {
        departmentType: query.departmentType,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('department.is_active = :isActive', {
        isActive: query.isActive === 'true',
      });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy) ? query.sortBy : 'createdAt';
    applySort(qb, 'department', sortBy, query.sortOrder);

    const [data, total] = await qb.skip(query.offset).take(query.limit).getManyAndCount();
    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  async create(dto: CreateDepartmentDto, tenant: TenantContext) {
    await this.assertCodeAvailable(dto.code, tenant);

    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      departmentType: dto.departmentType ?? 'OPD',
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      organizationId: tenant.organizationId,
      locationId: dto.locationId ?? tenant.locationId,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateDepartmentDto, tenant: TenantContext) {
    const department = await this.findOneScoped(id, tenant);
    if (dto.code && dto.code !== department.code) {
      await this.assertCodeAvailable(dto.code, tenant, id);
    }
    Object.assign(department, dto);
    return this.repo.save(department);
  }

  async remove(id: string, tenant: TenantContext) {
    const department = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(department);
    return { ok: true };
  }

  private async assertCodeAvailable(code: string, tenant: TenantContext, excludeId?: string) {
    const qb = this.repo
      .createQueryBuilder('department')
      .where('department.code = :code', { code })
      .andWhere('department.deleted_at IS NULL');
    if (tenant.organizationId) {
      qb.andWhere('department.organization_id = :orgId', {
        orgId: tenant.organizationId,
      });
    }
    if (excludeId) {
      qb.andWhere('department.id != :excludeId', { excludeId });
    }
    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException('Department code already exists');
    }
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('department')
      .where('department.id = :id', { id })
      .andWhere('department.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(department.organization_id = :orgId OR department.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const department = await qb.getOne();
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }
}