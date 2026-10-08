import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VisitOrmEntity } from '../entities/visit.orm-entity';
import { VisitCommentOrmEntity } from '../entities/visit-comment.orm-entity';
import { AppointmentOrmEntity } from '../../appointments/entities/appointment.orm-entity';
import { CreateVisitDto, EndVisitDto, UpdateVisitDto } from '../dto/visit.dto';
import { CreateVisitCommentDto } from '../dto/visit-comment.dto';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort, applyTimestampFilter, dslFilterValue } from '../../../database/list';
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
    @InjectRepository(VisitCommentOrmEntity)
    private readonly commentsRepo: Repository<VisitCommentOrmEntity>,
    @InjectRepository(AppointmentOrmEntity)
    private readonly appointmentRepo: Repository<AppointmentOrmEntity>,
  ) {}

  async list(
    query: ListQueryDto & {
      status?: string;
      providerId?: string;
      patientId?: string;
      createdAt?: string;
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

    // `created_at` is a timestamp: day-based DATE filters are expanded to
    // full-day ranges so they match rows at any time inside the day.
    if (query.createdAt && query.createdAt.includes('|')) {
      applyTimestampFilter(qb, 'visit', 'createdAt', query.createdAt);
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
      .orderBy('visit.startDatetime', 'DESC');

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
    const startDatetime = dto.startDatetime
      ? new Date(dto.startDatetime)
      : new Date();
    const entity = this.repo.create({
      ...dto,
      visitNumber: generateNumber('VIS'),
      patientName: dto.patientName ?? dto.patientId,
      status: 'ONGOING',
      startDatetime,
      organizationId: tenant.organizationId,
      locationId: dto.locationId ?? tenant.locationId,
      createdById: user.sub,
    });
    const saved = await this.repo.save(entity);

    // Auto-create an appointment when none exists for this patient at the
    // visit's start time (walk-ins / direct visits without a booking).
    if (!dto.appointmentId) {
      await this.ensureAppointment(saved, tenant, user);
    }
    return saved;
  }

  /**
   * Creates a SCHEDULED appointment for the visit's patient when no open
   * appointment already exists for that patient on the visit's date.
   * Best-effort: never fails the visit creation.
   */
  private async ensureAppointment(
    visit: VisitOrmEntity,
    tenant: TenantContext,
    user: RequestUser,
  ): Promise<void> {
    try {
      const visitDate = visit.startDatetime
        ? new Date(visit.startDatetime).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const existing = await this.appointmentRepo
        .createQueryBuilder('appointment')
        .where('appointment.patient_id = :patientId', {
          patientId: visit.patientId,
        })
        .andWhere('appointment.date = :date', { date: visitDate })
        .andWhere('appointment.deleted_at IS NULL')
        .andWhere(
          'appointment.status NOT IN (:...closed)',
          { closed: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] },
        )
        .andWhere(
          '(appointment.organization_id = :orgId OR appointment.organization_id IS NULL)',
          { orgId: tenant.organizationId },
        )
        .getOne();

      if (existing) return;

      const startTime = visit.startDatetime
        ? new Date(visit.startDatetime).toTimeString().slice(0, 5)
        : new Date().toTimeString().slice(0, 5);

      await this.appointmentRepo.save(
        this.appointmentRepo.create({
          appointmentNumber: generateNumber('APT'),
          patientId: visit.patientId,
          patientName: visit.patientName,
          appointmentType: 'CONSULTATION',
          date: visitDate,
          startTime,
          status: 'SCHEDULED',
          priority: 'ROUTINE',
          reason: `Auto-created from visit ${visit.visitNumber}`,
          visitId: visit.id,
          organizationId: tenant.organizationId,
          locationId: visit.locationId ?? tenant.locationId,
          createdById: user.sub,
        }),
      );
    } catch {
      // Best-effort — visit creation must not fail if appointment sync fails.
    }
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

  async listComments(visitId: string, tenant: TenantContext) {
    await this.findOneScoped(visitId, tenant);
    return this.commentsRepo
      .createQueryBuilder('comment')
      .where('comment.visit_id = :visitId', { visitId })
      .andWhere('comment.deleted_at IS NULL')
      .orderBy('comment.createdAt', 'ASC')
      .getMany();
  }

  async addComment(
    visitId: string,
    dto: CreateVisitCommentDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    await this.findOneScoped(visitId, tenant);
    const comment = this.commentsRepo.create({
      visitId,
      comment: dto.comment,
      authorName: dto.authorName ?? user.username,
      createdById: user.sub,
    });
    return this.commentsRepo.save(comment);
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
