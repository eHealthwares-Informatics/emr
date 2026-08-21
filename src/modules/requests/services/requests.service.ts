import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestOrmEntity } from '../entities/request.orm-entity';
import { RequestItemOrmEntity } from '../entities/request-item.orm-entity';
import { RequestStatusHistoryOrmEntity } from '../entities/request-status-history.orm-entity';
import {
  CreateRequestDto,
  SyncRequestDto,
  TransitionRequestStatusDto,
  UpdateRequestDto,
} from '../dto/request.dto';
import { LisIntegrationService } from './lis-integration.service';
import { PharmacyIntegrationService } from './pharmacy-integration.service';
import { TenantContext } from '../../../common/tenant-context';
import { AuditLogService } from '../../../common/audit/services/audit-log.service';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';
import { generateNumber } from '../../../shared/utils/numbers';
import { RequestStatus, SyncStatus } from '../../../shared/domain/enums';

const SORT_ALLOW_LIST = [
  'requestNumber',
  'patientName',
  'requestType',
  'status',
  'priority',
  'requestedAt',
  'createdAt',
  'updatedAt',
];

const STATUS_TRANSITIONS: Record<string, RequestStatus[]> = {
  REQUESTED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED', 'REJECTED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(RequestOrmEntity)
    private readonly repo: Repository<RequestOrmEntity>,
    @InjectRepository(RequestItemOrmEntity)
    private readonly itemRepo: Repository<RequestItemOrmEntity>,
    @InjectRepository(RequestStatusHistoryOrmEntity)
    private readonly historyRepo: Repository<RequestStatusHistoryOrmEntity>,
    private readonly lisIntegration: LisIntegrationService,
    private readonly pharmacyIntegration: PharmacyIntegrationService,
    private readonly auditLogService: AuditLogService,
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
    query: ListQueryDto & {
      status?: string;
      requestType?: string;
      patientId?: string;
      visitId?: string;
      encounterId?: string;
      providerId?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('request')
      .where('request.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(request.organization_id = :orgId OR request.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(request.patient_name ILIKE :search OR request.patient_id ILIKE :search OR request.request_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }
    if (query.requestType) {
      qb.andWhere('request.request_type = :requestType', { requestType: query.requestType });
    }
    if (query.patientId) {
      qb.andWhere('request.patient_id = :patientId', { patientId: query.patientId });
    }
    if (query.visitId) {
      qb.andWhere('request.visit_id = :visitId', { visitId: query.visitId });
    }
    if (query.encounterId) {
      qb.andWhere('request.encounter_id = :encounterId', { encounterId: query.encounterId });
    }
    if (query.providerId) {
      qb.andWhere('request.ordering_provider_id = :providerId', { providerId: query.providerId });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy) ? query.sortBy : 'requestedAt';
    applySort(qb, 'request', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    const request = await this.findOneScoped(id, tenant);
    const items = await this.itemRepo.find({
      where: { requestId: id, deletedAt: null as any },
    });
    const statusHistory = await this.historyRepo.find({
      where: { requestId: id, deletedAt: null as any },
      order: { createdAt: 'ASC' },
    });
    return { ...request, items, statusHistory };
  }

  async getHistory(id: string, tenant: TenantContext) {
    // Scoped existence check first so the tenant never sees another org's history.
    await this.findOneScoped(id, tenant);
    const statusHistory = await this.historyRepo.find({
      where: { requestId: id, deletedAt: null as any },
      order: { createdAt: 'ASC' },
    });
    return { data: statusHistory };
  }

  async create(dto: CreateRequestDto, tenant: TenantContext, user: RequestUser, token?: string) {
    const entity = this.repo.create({
      ...dto,
      requestNumber: generateNumber('REQ'),
      status: 'REQUESTED',
      syncStatus: 'NONE',
      requestedAt: dto.requestedAt ? new Date(dto.requestedAt) : new Date(),
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      createdById: user.sub,
    });
    entity.items = (dto.items ?? []).map((item) =>
      this.itemRepo.create({ ...item, contrast: item.contrast ?? false }),
    );

    const saved = await this.repo.save(entity);
    await this.historyRepo.save(
      this.historyRepo.create({
        requestId: saved.id,
        fromStatus: null,
        toStatus: 'REQUESTED',
        reason: null,
        actorUserId: user.sub,
        actorUsername: user.username ?? null,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      }),
    );
    this.audit({
      tenant,
      user,
      action: 'request.created',
      metadata: {
        requestId: saved.id,
        requestNumber: saved.requestNumber,
        requestType: saved.requestType,
        status: 'REQUESTED',
        priority: saved.priority ?? null,
        patientId: saved.patientId,
        patientName: saved.patientName ?? null,
      },
    });
    await this.syncRequest(saved, token);
    return this.get(saved.id, tenant);
  }

  async update(id: string, dto: UpdateRequestDto, tenant: TenantContext) {
    const request = await this.findOneScoped(id, tenant);
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(request.status)) {
      throw new BadRequestException(`Requests in status ${request.status} cannot be edited`);
    }

    Object.assign(request, dto);
    if (dto.items) {
      await this.itemRepo.delete({ requestId: id });
      request.items = (dto.items ?? []).map((item) =>
        this.itemRepo.create({ ...item, requestId: id, contrast: item.contrast ?? false }),
      );
    }
    return this.repo.save(request);
  }

  async transition(
    id: string,
    dto: TransitionRequestStatusDto,
    tenant: TenantContext,
    user: RequestUser,
    token?: string,
  ) {
    const request = await this.findOneScoped(id, tenant);
    const fromStatus = request.status;

    const allowed = STATUS_TRANSITIONS[request.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition request from ${request.status} to ${dto.status}`,
      );
    }

    request.status = dto.status;
    if (dto.status === 'COMPLETED') {
      request.completedAt = new Date();
    }

    if (dto.status === 'CANCELLED' && request.externalOrderId) {
      try {
        await this.lisIntegration.cancelLabOrder(request.externalOrderId, token);
      } catch {
        // keep local cancel; external cancel failure is non-fatal
      }
    }

    const saved = await this.repo.save(request);
    await this.historyRepo.save(
      this.historyRepo.create({
        requestId: saved.id,
        fromStatus,
        toStatus: dto.status,
        reason: dto.reason ?? null,
        actorUserId: user?.sub ?? null,
        actorUsername: user?.username ?? null,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      }),
    );
    this.audit({
      tenant,
      user,
      action: 'request.status_transition',
      metadata: {
        requestId: saved.id,
        requestNumber: saved.requestNumber,
        fromStatus,
        toStatus: dto.status,
        reason: dto.reason ?? null,
      },
    });
    return saved;
  }

  async addNote(id: string, note: string, tenant: TenantContext, user: RequestUser) {
    const request = await this.findOneScoped(id, tenant);
    if (!note.trim()) {
      throw new BadRequestException('Note cannot be empty');
    }
    const entry = await this.historyRepo.save(
      this.historyRepo.create({
        requestId: request.id,
        fromStatus: null,
        toStatus: null,
        reason: note.trim(),
        actorUserId: user?.sub ?? null,
        actorUsername: user?.username ?? null,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      }),
    );
    this.audit({
      tenant,
      user,
      action: 'request.note_added',
      metadata: {
        requestId: request.id,
        requestNumber: request.requestNumber,
        note: note.trim(),
      },
    });
    return entry;
  }

  async sync(id: string, dto: SyncRequestDto, tenant: TenantContext, token?: string) {
    const request = await this.findOneScoped(id, tenant);
    if (dto.externalOrderId) request.externalOrderId = dto.externalOrderId;
    if (dto.externalReference) request.externalReference = dto.externalReference;
    const saved = await this.repo.save(request);
    await this.syncRequest(saved, token);
    return this.get(saved.id, tenant);
  }

  async remove(id: string, tenant: TenantContext) {
    const request = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(request);
    return { ok: true };
  }

  private async syncRequest(request: RequestOrmEntity, token?: string): Promise<void> {
    if (request.requestType !== 'LAB' && request.requestType !== 'PRESCRIPTION') {
      request.syncStatus = 'NONE';
      await this.repo.save(request);
      return;
    }

    request.syncStatus = 'PENDING';
    await this.repo.save(request);

    try {
      let result;
      if (request.requestType === 'LAB') {
        result = await this.lisIntegration.createLabOrder(request, token);
      } else {
        result = await this.pharmacyIntegration.createPrescriptionOrder(request, token);
      }

      request.externalOrderId = result.externalOrderId ?? request.externalOrderId;
      request.externalReference = result.externalReference ?? request.externalReference;
      request.syncStatus = 'SYNCED';
      request.syncError = null;
      await this.repo.save(request);
    } catch (error) {
      request.syncStatus = 'FAILED';
      request.syncError = error instanceof Error ? error.message : 'External sync failed';
      await this.repo.save(request);
    }
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('request')
      .where('request.id = :id', { id })
      .andWhere('request.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(request.organization_id = :orgId OR request.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const request = await qb.getOne();
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }
}
