import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppointmentOrmEntity } from '../entities/appointment.orm-entity';
import {
  CancelAppointmentDto,
  CheckInAppointmentDto,
  CreateAppointmentDto,
  RescheduleAppointmentDto,
  UpdateAppointmentDto,
} from '../dto/appointment.dto';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applyFilters, applySort, applyTimestampFilter } from '../../../database/list';
import { generateNumber } from '../../../shared/utils/numbers';
import { VisitsService } from '../../visits/services/visits.service';

const SORT_ALLOW_LIST = [
  'appointmentNumber',
  'patientName',
  'date',
  'startTime',
  'status',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(AppointmentOrmEntity)
    private readonly repo: Repository<AppointmentOrmEntity>,
    private readonly visitsService: VisitsService,
  ) {}

  async list(
    query: ListQueryDto & {
      status?: string;
      date?: string;
      providerId?: string;
      patientId?: string;
      patientName?: string;
      createdAt?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('appointment')
      .where('appointment.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(appointment.organization_id = :orgId OR appointment.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(appointment.patient_name ILIKE :search OR appointment.patient_id ILIKE :search OR appointment.appointment_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // DSL column filters from the frontend filter pattern (field=TYPE|value|valueTo).
    const dslFilters: Record<string, string> = {};
    for (const [field, raw] of [
      ['date', query.date],
      ['status', query.status],
      ['providerId', query.providerId],
      ['patientId', query.patientId],
    ] as const) {
      if (raw && raw.includes('|')) {
        dslFilters[field] = raw;
      }
    }
    if (Object.keys(dslFilters).length > 0) {
      applyFilters(qb, 'appointment', dslFilters);
    }

    // `created_at` is a timestamp: day-based DATE filters are expanded to
    // full-day ranges so they match rows at any time inside the day.
    if (query.createdAt && query.createdAt.includes('|')) {
      applyTimestampFilter(qb, 'appointment', 'createdAt', query.createdAt);
    }

    if (query.status && !query.status.includes('|')) {
      qb.andWhere('appointment.status = :status', { status: query.status });
    }
    if (query.date && !query.date.includes('|')) {
      qb.andWhere('appointment.date = :date', { date: query.date });
    }
    if (query.providerId && !query.providerId.includes('|')) {
      qb.andWhere('appointment.provider_id = :providerId', {
        providerId: query.providerId,
      });
    }
    if (query.patientId && !query.patientId.includes('|')) {
      qb.andWhere('appointment.patient_id = :patientId', {
        patientId: query.patientId,
      });
    }

    // Patient free-text filter: matches either the display name or the MRN.
    if (query.patientName) {
      const value = query.patientName.split('|')[1];
      if (value) {
        qb.andWhere(
          '(appointment.patient_name ILIKE :p OR appointment.patient_id ILIKE :p)',
          { p: `%${value}%` },
        );
      }
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'date';
    applySort(qb, 'appointment', sortBy, query.sortOrder);

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
    dto: CreateAppointmentDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const entity = this.repo.create({
      ...dto,
      appointmentNumber: generateNumber('APT'),
      status: 'SCHEDULED',
      priority: dto.priority ?? 'ROUTINE',
      organizationId: tenant.organizationId,
      locationId: dto.locationId ?? tenant.locationId,
      createdById: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateAppointmentDto, tenant: TenantContext) {
    const appointment = await this.findOneScoped(id, tenant);
    if (
      appointment.status === 'COMPLETED' ||
      appointment.status === 'CANCELLED'
    ) {
      throw new BadRequestException(
        'Completed or cancelled appointments cannot be edited',
      );
    }
    Object.assign(appointment, dto);
    return this.repo.save(appointment);
  }

  async checkIn(
    id: string,
    dto: CheckInAppointmentDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const appointment = await this.findOneScoped(id, tenant);

    if (
      appointment.status !== 'SCHEDULED' &&
      appointment.status !== 'CHECKED_IN'
    ) {
      throw new BadRequestException(
        `Appointment in status ${appointment.status} cannot be checked in`,
      );
    }

    appointment.status = 'CHECKED_IN';
    if (dto.locationId) appointment.locationId = dto.locationId;
    if (dto.providerId) {
      appointment.providerId = dto.providerId;
      appointment.providerName = dto.providerName ?? appointment.providerName;
    }
    await this.repo.save(appointment);

    const visit = await this.visitsService.create(
      {
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        visitType: 'OUTPATIENT',
        providerId: appointment.providerId ?? undefined,
        providerName: appointment.providerName ?? undefined,
        locationId: appointment.locationId ?? undefined,
        appointmentId: appointment.id,
      },
      tenant,
      user,
    );

    appointment.visitId = visit.id;
    appointment.status = 'IN_PROGRESS';
    await this.repo.save(appointment);

    return { appointment, visit };
  }

  async transition(
    id: string,
    status: 'CANCELLED' | 'NO_SHOW' | 'COMPLETED',
    tenant: TenantContext,
  ) {
    const appointment = await this.findOneScoped(id, tenant);

    if (status === 'COMPLETED' && appointment.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Only in-progress appointments can be completed',
      );
    }

    if (
      status === 'CANCELLED' &&
      ['COMPLETED', 'CANCELLED'].includes(appointment.status)
    ) {
      throw new BadRequestException(
        `Appointment in status ${appointment.status} cannot be cancelled`,
      );
    }

    if (status === 'NO_SHOW' && appointment.status !== 'SCHEDULED') {
      throw new BadRequestException(
        'Only scheduled appointments can be marked as no-show',
      );
    }

    appointment.status = status;
    return this.repo.save(appointment);
  }

  async cancel(id: string, dto: CancelAppointmentDto, tenant: TenantContext) {
    const appointment = await this.findOneScoped(id, tenant);
    if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
      throw new BadRequestException('Appointment is already closed');
    }
    appointment.status = 'CANCELLED';
    if (dto.reason) appointment.notes = dto.reason;
    return this.repo.save(appointment);
  }

  async reschedule(
    id: string,
    dto: RescheduleAppointmentDto,
    tenant: TenantContext,
  ) {
    const appointment = await this.findOneScoped(id, tenant);

    if (
      appointment.status === 'COMPLETED' ||
      appointment.status === 'CANCELLED' ||
      appointment.status === 'NO_SHOW' ||
      appointment.status === 'MISSED'
    ) {
      throw new BadRequestException(
        `Appointment in status ${appointment.status} cannot be rescheduled`,
      );
    }

    appointment.date = dto.date;
    appointment.startTime = dto.startTime;
    if (dto.endTime !== undefined) {
      appointment.endTime = dto.endTime;
    }

    return this.repo.save(appointment);
  }

  async remove(id: string, tenant: TenantContext) {
    const appointment = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(appointment);
    return { ok: true };
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('appointment')
      .where('appointment.id = :id', { id })
      .andWhere('appointment.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(appointment.organization_id = :orgId OR appointment.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const appointment = await qb.getOne();
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }
}
