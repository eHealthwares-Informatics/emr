import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BedOrmEntity } from '../entities/bed.orm-entity';
import { CreateBedDto, UpdateBedDto } from '../dto/bed.dto';
import { TenantContext } from '../../../common/tenant-context';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort, dslFilterValue } from '../../../database/list';
import type { BedStatus } from '../../../shared/domain/enums';

const SORT_ALLOW_LIST = [
  'code',
  'status',
  'bedType',
  'wardId',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class BedsService {
  constructor(
    @InjectRepository(BedOrmEntity)
    private readonly repo: Repository<BedOrmEntity>,
  ) {}

  async list(
    query: ListQueryDto & {
      wardId?: string;
      status?: string;
      bedType?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('bed')
      .where('bed.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(bed.organization_id = :orgId OR bed.organization_id IS NULL)',
        {
          orgId: tenant.organizationId,
        },
      );
    }

    if (query.search) {
      qb.andWhere('bed.code ILIKE :search', { search: `%${query.search}%` });
    }
    const wardId = dslFilterValue(query.wardId);
    if (wardId) {
      qb.andWhere('bed.ward_id = :wardId', { wardId });
    }
    const status = dslFilterValue(query.status);
    if (status) {
      qb.andWhere('bed.status = :status', { status });
    }
    const bedType = dslFilterValue(query.bedType);
    if (bedType) {
      qb.andWhere('bed.bed_type = :bedType', { bedType });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'code';
    applySort(qb, 'bed', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();
    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  async create(dto: CreateBedDto, tenant: TenantContext) {
    const entity = this.repo.create({
      code: dto.code,
      wardId: dto.wardId,
      bedType: dto.bedType ?? 'STANDARD',
      status: dto.status ?? 'AVAILABLE',
      notes: dto.notes ?? null,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateBedDto, tenant: TenantContext) {
    const bed = await this.findOneScoped(id, tenant);
    Object.assign(bed, dto);
    return this.repo.save(bed);
  }

  async setStatus(id: string, status: BedStatus, tenant: TenantContext) {
    const bed = await this.findOneScoped(id, tenant);
    bed.status = status;
    return this.repo.save(bed);
  }

  async remove(id: string, tenant: TenantContext) {
    const bed = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(bed);
    return { ok: true };
  }

  async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('bed')
      .where('bed.id = :id', { id })
      .andWhere('bed.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(bed.organization_id = :orgId OR bed.organization_id IS NULL)',
        {
          orgId: tenant.organizationId,
        },
      );
    }

    const bed = await qb.getOne();
    if (!bed) {
      throw new NotFoundException('Bed not found');
    }
    return bed;
  }

  async assertBedAvailable(
    id: string,
    tenant: TenantContext,
  ): Promise<BedOrmEntity> {
    const bed = await this.findOneScoped(id, tenant);
    if (bed.status === 'OCCUPIED') {
      throw new BadRequestException(`Bed ${bed.code} is already occupied`);
    }
    if (bed.status !== 'AVAILABLE') {
      throw new BadRequestException(`Bed ${bed.code} is not available`);
    }
    return bed;
  }
}
