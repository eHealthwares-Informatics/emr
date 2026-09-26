import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncounterOrmEntity } from '../entities/encounter.orm-entity';
import {
  CreateEncounterDto,
  CreateEncounterRequestDto,
  UpdateEncounterDto,
} from '../dto/encounter.dto';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';
import { generateNumber } from '../../../shared/utils/numbers';
import { VisitsService } from '../../visits/services/visits.service';
import { RequestsService } from '../../requests/services/requests.service';
import { PatientsService } from '../../patients/services/patients.service';

const SORT_ALLOW_LIST = [
  'encounterNumber',
  'encounterType',
  'encounterDatetime',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class EncountersService {
  constructor(
    @InjectRepository(EncounterOrmEntity)
    private readonly repo: Repository<EncounterOrmEntity>,
    private readonly visitsService: VisitsService,
    private readonly requestsService: RequestsService,
    private readonly patientsService: PatientsService,
  ) {}

  async list(
    query: ListQueryDto & {
      status?: string;
      patientId?: string;
      visitId?: string;
      encounterType?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('encounter')
      .where('encounter.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(encounter.organization_id = :orgId OR encounter.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(encounter.patient_id ILIKE :search OR encounter.encounter_number ILIKE :search OR encounter.reason ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.patientId) {
      qb.andWhere('encounter.patient_id = :patientId', {
        patientId: query.patientId,
      });
    }
    if (query.visitId) {
      qb.andWhere('encounter.visit_id = :visitId', { visitId: query.visitId });
    }
    if (query.status) {
      qb.andWhere('encounter.status = :status', { status: query.status });
    }
    if (query.encounterType) {
      qb.andWhere('encounter.encounter_type = :encounterType', {
        encounterType: query.encounterType,
      });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'encounterDatetime';
    applySort(qb, 'encounter', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  async create(
    dto: CreateEncounterDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    if (dto.visitId) {
      const visit = await this.visitsService.get(dto.visitId, tenant);
      if (visit.patientId !== dto.patientId) {
        throw new BadRequestException(
          'Visit belongs to a different patient than the encounter',
        );
      }
      if (visit.status !== 'ONGOING') {
        throw new BadRequestException(
          'Cannot add an encounter to a closed visit',
        );
      }
    }

    const entity = this.repo.create({
      ...dto,
      encounterNumber: generateNumber('ENC'),
      encounterDatetime: dto.encounterDatetime
        ? new Date(dto.encounterDatetime)
        : new Date(),
      status: dto.status ?? 'ACTIVE',
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      createdById: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateEncounterDto, tenant: TenantContext) {
    const encounter = await this.findOneScoped(id, tenant);
    const { endedAt, ...rest } = dto;
    Object.assign(encounter, rest);
    if (endedAt) {
      encounter.endedAt = new Date(endedAt);
    }
    return this.repo.save(encounter);
  }

  async createRequest(
    encounterId: string,
    dto: CreateEncounterRequestDto,
    tenant: TenantContext,
    user: RequestUser,
    token?: string,
  ) {
    const encounter = await this.findOneScoped(encounterId, tenant);
    const patient = await this.patientsService.getByPatientId(
      encounter.patientId,
      tenant,
    );
    const patientName =
      [patient.firstName, patient.lastName].filter(Boolean).join(' ') ||
      encounter.patientId;
    return this.requestsService.create(
      {
        ...dto,
        patientId: encounter.patientId,
        patientName,
        encounterId: encounter.id,
        visitId: encounter.visitId ?? undefined,
      },
      tenant,
      user,
      token,
    );
  }

  async remove(id: string, tenant: TenantContext) {
    const encounter = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(encounter);
    return { ok: true };
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('encounter')
      .where('encounter.id = :id', { id })
      .andWhere('encounter.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(encounter.organization_id = :orgId OR encounter.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const encounter = await qb.getOne();
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }
    return encounter;
  }
}
