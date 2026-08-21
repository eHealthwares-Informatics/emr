import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffOrmEntity } from '../entities/staff.orm-entity';
import { CreateStaffDto, UpdateStaffDto } from '../dto/staff.dto';
import { TenantContext } from '../../../common/tenant-context';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';
import { generateNumber } from '../../../shared/utils/numbers';

const SORT_ALLOW_LIST = ['staffNumber', 'firstName', 'lastName', 'roleType', 'department', 'createdAt'];

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffOrmEntity)
    private readonly repo: Repository<StaffOrmEntity>,
  ) {}

  async list(
    query: ListQueryDto & {
      roleType?: string;
      category?: string;
      department?: string;
      isActive?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo.createQueryBuilder('staff').where('staff.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(staff.organization_id = :orgId OR staff.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(staff.first_name ILIKE :search OR staff.last_name ILIKE :search OR staff.other_names ILIKE :search OR staff.staff_number ILIKE :search OR staff.email ILIKE :search OR staff.department ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.roleType) {
      qb.andWhere('staff.role_type = :roleType', { roleType: query.roleType });
    }
    if (query.category) {
      qb.andWhere('staff.category = :category', { category: query.category });
    }
    if (query.department) {
      qb.andWhere('staff.department ILIKE :department', {
        department: `%${query.department}%`,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('staff.is_active = :isActive', {
        isActive: query.isActive === 'true',
      });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy) ? query.sortBy : 'staffNumber';
    applySort(qb, 'staff', sortBy, query.sortOrder);

    const [data, total] = await qb.skip(query.offset).take(query.limit).getManyAndCount();
    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  async create(dto: CreateStaffDto, tenant: TenantContext) {
    const entity = this.repo.create({
      ...dto,
      staffNumber: dto.staffNumber?.trim() || generateNumber('STF'),
      isActive: dto.isActive ?? true,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateStaffDto, tenant: TenantContext) {
    const staff = await this.findOneScoped(id, tenant);
    Object.assign(staff, dto);
    return this.repo.save(staff);
  }

  async remove(id: string, tenant: TenantContext) {
    const staff = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(staff);
    return { ok: true };
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('staff')
      .where('staff.id = :id', { id })
      .andWhere('staff.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(staff.organization_id = :orgId OR staff.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const staff = await qb.getOne();
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
    return staff;
  }
}
