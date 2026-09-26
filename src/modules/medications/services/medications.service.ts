import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicationOrmEntity } from '../entities/medication.orm-entity';
import {
  AdministerMedicationDto,
  CreateMedicationDto,
} from '../dto/medication.dto';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';
import { generateNumber } from '../../../shared/utils/numbers';
import { RequestsService } from '../../requests/services/requests.service';

const SORT_ALLOW_LIST = [
  'medicationNumber',
  'status',
  'administeredAt',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class MedicationsService {
  constructor(
    @InjectRepository(MedicationOrmEntity)
    private readonly repo: Repository<MedicationOrmEntity>,
    private readonly requestsService: RequestsService,
  ) {}

  async list(
    query: ListQueryDto & {
      status?: string;
      patientId?: string;
      requestId?: string;
      encounterId?: string;
      administered?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('medication')
      .where('medication.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(medication.organization_id = :orgId OR medication.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.status) {
      qb.andWhere('medication.status = :status', { status: query.status });
    }
    if (query.patientId) {
      qb.andWhere('medication.patient_id = :patientId', {
        patientId: query.patientId,
      });
    }
    if (query.requestId) {
      qb.andWhere('medication.request_id = :requestId', {
        requestId: query.requestId,
      });
    }
    if (query.encounterId) {
      qb.andWhere('medication.encounter_id = :encounterId', {
        encounterId: query.encounterId,
      });
    }
    if (query.administered === 'true') {
      qb.andWhere('medication.administered_at IS NOT NULL');
    } else if (query.administered === 'false') {
      qb.andWhere('medication.administered_at IS NULL');
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    applySort(qb, 'medication', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  /**
   * Nurse flow: create a medication record from a PRESCRIPTION request item.
   * The request must be a prescription; each item converts once.
   */
  async create(
    dto: CreateMedicationDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const request = await this.requestsService.get(dto.requestId, tenant);
    if (request.requestType !== 'PRESCRIPTION') {
      throw new BadRequestException(
        'Medications can only be created from PRESCRIPTION requests',
      );
    }
    if (request.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot create medication from a cancelled request',
      );
    }

    const item = request.items?.[dto.itemIndex];
    if (!item) {
      throw new BadRequestException(
        `Prescription item ${dto.itemIndex} does not exist on this request`,
      );
    }

    const existing = await this.repo.findOne({
      where: {
        requestId: dto.requestId,
        name: dto.name ?? item.name,
        organizationId: tenant.organizationId,
      },
    } as never);
    if (existing && existing.status !== 'CANCELLED') {
      throw new BadRequestException(
        'A medication record already exists for this prescription item',
      );
    }

    const entity = this.repo.create({
      medicationNumber: generateNumber('MED'),
      requestId: request.id,
      patientId: request.patientId,
      patientName: request.patientName ?? null,
      encounterId: request.encounterId ?? null,
      visitId: request.visitId ?? null,
      name: dto.name ?? item.name,
      dose: dto.dose ?? item.dose ?? null,
      doseUnit: dto.doseUnit ?? item.doseUnit ?? null,
      route: dto.route ?? item.route ?? null,
      frequency: dto.frequency ?? item.frequency ?? null,
      duration: dto.duration ?? item.duration ?? null,
      durationUnit: dto.durationUnit ?? item.durationUnit ?? null,
      quantity: dto.quantity ?? item.quantity ?? null,
      instructions: dto.instructions ?? item.instructions ?? null,
      status: 'PRESCRIBED',
      createdById: user.sub,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  /**
   * Record administration of a medication by the signed-in nurse and mark the
   * originating prescription request COMPLETED so it leaves the work queue.
   */
  async administer(
    id: string,
    dto: AdministerMedicationDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const medication = await this.findOneScoped(id, tenant);
    if (medication.administeredAt) {
      throw new BadRequestException('Medication was already administered');
    }
    if (medication.status === 'CANCELLED') {
      throw new BadRequestException('Cannot administer a cancelled medication');
    }

    medication.status = dto.outcome ?? 'ADMINISTERED';
    medication.administeredAt = dto.administeredAt
      ? new Date(dto.administeredAt)
      : new Date();
    medication.administeredById = user.sub;
    medication.administeredByName = user.username ?? null;
    medication.administrationNotes = dto.notes ?? null;
    const saved = await this.repo.save(medication);

    try {
      const request = await this.requestsService.get(medication.requestId, tenant);
      if (request.status !== 'COMPLETED') {
        await this.requestsService.transition(
          medication.requestId,
          { status: 'COMPLETED', reason: 'Medication administered (mobile)' },
          tenant,
          user,
        );
      }
    } catch {
      // Request transition is best-effort; the administration is recorded.
    }

    return saved;
  }

  async update(
    id: string,
    dto: Record<string, unknown>,
    tenant: TenantContext,
  ) {
    const medication = await this.findOneScoped(id, tenant);
    const mutable = medication as unknown as Record<string, unknown>;
    for (const key of [
      'status',
      'dose',
      'doseUnit',
      'route',
      'frequency',
      'instructions',
      'administrationNotes',
    ] as const) {
      if (dto[key] !== undefined) {
        mutable[key] = dto[key];
      }
    }
    return this.repo.save(medication);
  }

  async remove(id: string, tenant: TenantContext) {
    const medication = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(medication);
    return { ok: true };
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('medication')
      .where('medication.id = :id', { id })
      .andWhere('medication.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(medication.organization_id = :orgId OR medication.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const medication = await qb.getOne();
    if (!medication) {
      throw new NotFoundException('Medication not found');
    }
    return medication;
  }
}
