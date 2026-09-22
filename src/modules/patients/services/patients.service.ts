import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PatientOrmEntity } from '../entities/patient.orm-entity';
import { CreatePatientDto, UpdatePatientDto } from '../dto/patient.dto';
import { TagsService } from '../../tags/services/tags.service';
import type { TagSummary } from '../../tags/services/tags.service';
import { TenantContext } from '../../../common/tenant-context';
import { AuditLogService } from '../../../common/audit/services/audit-log.service';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort, dslFilterValue } from '../../../database/list';
import { generateNumber } from '../../../shared/utils/numbers';

const SORT_ALLOW_LIST = [
  'patientId',
  'firstName',
  'lastName',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(PatientOrmEntity)
    private readonly repo: Repository<PatientOrmEntity>,
    private readonly auditLogService: AuditLogService,
    private readonly tagsService: TagsService,
  ) {}

  private audit(entry: {
    tenant: TenantContext;
    user: RequestUser;
    action: string;
    metadata: Record<string, unknown>;
  }) {
    // Fire-and-forget: an audit write failure must never fail the main operation.
    void this.auditLogService
      .record({
        organizationId: entry.tenant.organizationId,
        actorUserId: entry.user?.sub ?? null,
        actorUsername: entry.user?.username ?? null,
        action: entry.action,
        httpMethod: null,
        httpPath: null,
        statusCode: null,
        durationMs: null,
        ipAddress: null,
        userAgent: null,
        metadata: entry.metadata,
      })
      .catch(() => undefined);
  }

  async list(
    query: ListQueryDto & { gender?: string; isActive?: string },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('patient')
      .where('patient.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(patient.organization_id = :orgId OR patient.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(patient.patient_id ILIKE :search OR patient.first_name ILIKE :search OR patient.last_name ILIKE :search OR patient.other_names ILIKE :search OR patient.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.filter) {
      const [field, value] = query.filter.split('|');
      if (field && value && field === 'gender') {
        qb.andWhere('patient.gender = :gender', { gender: value });
      }
    }

    const gender = dslFilterValue(query.gender);
    if (gender) {
      qb.andWhere('patient.gender = :gender', { gender });
    }
    if (query.isActive !== undefined) {
      const active = dslFilterValue(query.isActive);
      if (active !== undefined) {
        qb.andWhere('patient.is_active = :isActive', {
          isActive: active === 'true',
        });
      }
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    applySort(qb, 'patient', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    const withTags = await this.attachTags(data);
    return { data: withTags, total };
  }

  /** Batch-attaches each patient's tags for the current page of rows. */
  private async attachTags(
    patients: PatientOrmEntity[],
  ): Promise<Array<PatientOrmEntity & { tags: TagSummary[] }>> {
    const tagMap = await this.tagsService.tagsForPatients(
      patients.map((p) => String(p.id)),
    );
    return patients.map((patient) => ({
      ...patient,
      tags: tagMap.get(String(patient.id)) ?? [],
    }));
  }

  async getTags(patientId: string, tenant: TenantContext) {
    const patient = await this.findOneScoped(patientId, tenant);
    const tagMap = await this.tagsService.tagsForPatients([String(patient.id)]);
    return { patientId, tags: tagMap.get(String(patient.id)) ?? [] };
  }

  async assignTags(
    patientId: string,
    tagIds: string[],
    tenant: TenantContext,
  ) {
    await this.findOneScoped(patientId, tenant);
    return this.tagsService.assignToPatient(patientId, { tagIds }, tenant);
  }

  async get(id: string, tenant: TenantContext) {
    const patient = await this.findOneScoped(id, tenant);
    return this.attachTags([patient]).then(([withTags]) => withTags);
  }

  async getByPatientId(patientId: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('patient')
      .where('patient.patient_id = :patientId', { patientId })
      .andWhere('patient.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(patient.organization_id = :orgId OR patient.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const patient = await qb.getOne();
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  async create(
    dto: CreatePatientDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const patientId = dto.patientId?.trim() || this.generatePatientId();

    const existing = await this.repo.findOne({
      where: { patientId, deletedAt: IsNull() },
    });
    if (existing) {
      throw new BadRequestException(
        `Patient with MRN ${patientId} already exists`,
      );
    }

    const entity = this.repo.create({
      ...dto,
      patientId,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      identifiers: dto.identifiers ?? [],
      paymentProviderIds: dto.paymentProviderIds ?? [],
    });
    const saved = await this.repo.save(entity);
    this.audit({
      tenant,
      user,
      action: 'patient.created',
      metadata: {
        patientId: saved.patientId,
        patientName:
          [saved.firstName, saved.lastName].filter(Boolean).join(' ') || null,
        gender: saved.gender ?? null,
        dateOfBirth: saved.dateOfBirth ?? null,
      },
    });
    return saved;
  }

  async update(
    id: string,
    dto: UpdatePatientDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const patient = await this.findOneScoped(id, tenant);
    const before = Object.fromEntries(
      Object.keys(dto).map((key) => [
        key,
        (patient as unknown as Record<string, unknown>)[key],
      ]),
    );
    Object.assign(patient, dto);
    const saved = await this.repo.save(patient);

    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, to] of Object.entries(dto)) {
      const from = before[key];
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changedFields[key] = { from, to };
      }
    }

    this.audit({
      tenant,
      user,
      action: 'patient.updated',
      metadata: {
        patientId: saved.patientId,
        patientName:
          [saved.firstName, saved.lastName].filter(Boolean).join(' ') || null,
        changedFields,
      },
    });
    return saved;
  }

  async remove(id: string, tenant: TenantContext) {
    const patient = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(patient);
    return { ok: true };
  }

  private generatePatientId(): string {
    return generateNumber('MRN');
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('patient')
      .where('patient.id = :id', { id })
      .andWhere('patient.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(patient.organization_id = :orgId OR patient.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const patient = await qb.getOne();
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }
}
