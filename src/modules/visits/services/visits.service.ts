import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VisitOrmEntity } from '../entities/visit.orm-entity';
import { CreateVisitDto, EndVisitDto, UpdateVisitDto } from '../dto/visit.dto';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort, dslFilterValue } from '../../../database/list';
import { generateNumber } from '../../../shared/utils/numbers';

const SORT_ALLOW_LIST = [
  'visitNumber',
  'patientName',
  'visitType',
  'status',
  'startDatetime',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(VisitOrmEntity)
    private readonly repo: Repository<VisitOrmEntity>,
  ) {}

  async list(
    query: ListQueryDto & {
      status?: string;
      providerId?: string;
      patientId?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('visit')
      .where('visit.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(visit.organization_id = :orgId OR visit.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(visit.patient_name ILIKE :search OR visit.patient_id ILIKE :search OR visit.visit_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const status = dslFilterValue(query.status);
    if (status) {
      qb.andWhere('visit.status = :status', { status });
    }
    const providerId = dslFilterValue(query.providerId);
    if (providerId) {
      qb.andWhere('visit.provider_id = :providerId', { providerId });
    }
    const patientId = dslFilterValue(query.patientId);
    if (patientId) {
      qb.andWhere('visit.patient_id = :patientId', { patientId });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'startDatetime';
    applySort(qb, 'visit', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return { data, total };
  }

  async active(tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('visit')
      .where('visit.status = :status', { status: 'ONGOING' })
      .andWhere('visit.deleted_at IS NULL')
      .orderBy('visit.start_datetime', 'DESC');

    if (tenant.organizationId) {
      qb.andWhere(
        '(visit.organization_id = :orgId OR visit.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    const visit = await this.findOneScoped(id, tenant);
    return visit;
  }

  async create(dto: CreateVisitDto, tenant: TenantContext, user: RequestUser) {
    const entity = this.repo.create({
      ...dto,
      visitNumber: generateNumber('VIS'),
      patientName: dto.patientName ?? dto.patientId,
      status: 'ONGOING',
      startDatetime: dto.startDatetime
        ? new Date(dto.startDatetime)
        : new Date(),
      organizationId: tenant.organizationId,
      locationId: dto.locationId ?? tenant.locationId,
      createdById: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateVisitDto, tenant: TenantContext) {
    const visit = await this.findOneScoped(id, tenant);
    Object.assign(visit, dto);
    return this.repo.save(visit);
  }

  async end(id: string, dto: EndVisitDto, tenant: TenantContext) {
    const visit = await this.findOneScoped(id, tenant);
    if (visit.status === 'COMPLETED') {
      throw new BadRequestException('Visit is already completed');
    }
    visit.stopDatetime = dto.stopDatetime
      ? new Date(dto.stopDatetime)
      : new Date();
    visit.status = 'COMPLETED';
    return this.repo.save(visit);
  }

  async cancel(id: string, tenant: TenantContext) {
    const visit = await this.findOneScoped(id, tenant);
    if (visit.status !== 'ONGOING') {
      throw new BadRequestException('Only ongoing visits can be cancelled');
    }
    visit.status = 'CANCELLED';
    visit.stopDatetime = new Date();
    return this.repo.save(visit);
  }

  async remove(id: string, tenant: TenantContext) {
    const visit = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(visit);
    return { ok: true };
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('visit')
      .where('visit.id = :id', { id })
      .andWhere('visit.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(visit.organization_id = :orgId OR visit.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const visit = await qb.getOne();
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    return visit;
  }
}
