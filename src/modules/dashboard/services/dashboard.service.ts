import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppointmentOrmEntity } from '../../appointments/entities/appointment.orm-entity';
import { VisitOrmEntity } from '../../visits/entities/visit.orm-entity';
import { PatientOrmEntity } from '../../patients/entities/patient.orm-entity';
import { RequestOrmEntity } from '../../requests/entities/request.orm-entity';
import { TenantContext } from '../../../common/tenant-context';

const TODAY_APPOINTMENT_SORT: Record<string, string> = {
  appointmentNumber: 'appointment.appointment_number',
  patientName: 'appointment.patient_name',
  date: 'appointment.date',
  startTime: 'appointment.start_time',
  status: 'appointment.status',
  createdAt: 'appointment.created_at',
  updatedAt: 'appointment.updated_at',
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(AppointmentOrmEntity)
    private readonly appointmentRepo: Repository<AppointmentOrmEntity>,
    @InjectRepository(VisitOrmEntity)
    private readonly visitRepo: Repository<VisitOrmEntity>,
    @InjectRepository(PatientOrmEntity)
    private readonly patientRepo: Repository<PatientOrmEntity>,
    @InjectRepository(RequestOrmEntity)
    private readonly requestRepo: Repository<RequestOrmEntity>,
  ) {}

  async summary(tenant: TenantContext, today: string) {
    const [appointments, activeVisits, todaysVisits, totalPatients, pendingRequests] = await Promise.all([
      this.listTodayAppointments(today, tenant),
      this.listActiveVisits(tenant),
      this.listTodaysVisits(today, tenant),
      this.countActivePatients(tenant),
      this.countPendingRequests(tenant),
    ]);

    const statusCounts = {
      SCHEDULED: 0,
      CHECKED_IN: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      NO_SHOW: 0,
      MISSED: 0,
    };
    for (const a of appointments) {
      if (a.status in statusCounts) {
        statusCounts[a.status as keyof typeof statusCounts]++;
      }
    }

    const visitStartByAppointmentId = new Map<string, Date>();
    for (const v of todaysVisits) {
      if (v.appointmentId) {
        visitStartByAppointmentId.set(v.appointmentId, v.startDatetime);
      }
    }

    const averageWaitMinutes = this.computeAverageWaitMinutes(appointments, today, visitStartByAppointmentId);

    const providerMap = new Map<string, { providerId: string; providerName: string; patientCount: number }>();
    for (const v of activeVisits) {
      const key = v.providerId ?? v.providerName ?? 'unknown';
      const entry = providerMap.get(key) ?? {
        providerId: v.providerId ?? '',
        providerName: v.providerName ?? 'Unassigned',
        patientCount: 0,
      };
      entry.patientCount++;
      providerMap.set(key, entry);
    }
    const providerLoad = Array.from(providerMap.values()).sort((a, b) => b.patientCount - a.patientCount);

    const upcoming = await this.listUpcomingAppointments(today, tenant, 6);

    return {
      date: today,
      metrics: {
        totalAppointments: appointments.length,
        checkedIn: statusCounts.CHECKED_IN + statusCounts.IN_PROGRESS,
        inProgress: statusCounts.IN_PROGRESS,
        completed: statusCounts.COMPLETED,
        scheduled: statusCounts.SCHEDULED,
        cancelled: statusCounts.CANCELLED,
        noShow: statusCounts.NO_SHOW,
        providersOnDuty: providerLoad.length,
        averageWaitMinutes,
        totalPatients,
        activeVisits: activeVisits.length,
        pendingRequests,
      },
      appointments,
      providerLoad,
      upcoming,
    };
  }

  private async listTodayAppointments(today: string, tenant: TenantContext) {
    const qb = this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.date = :today', { today })
      .andWhere('appointment.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(appointment.organization_id = :orgId OR appointment.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    qb.orderBy('appointment.start_time', 'ASC');

    return qb.getMany();
  }

  private async listUpcomingAppointments(today: string, tenant: TenantContext, limit: number) {
    const qb = this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.date >= :today', { today })
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS'],
      })
      .andWhere('appointment.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(appointment.organization_id = :orgId OR appointment.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    qb.orderBy('appointment.date', 'ASC').addOrderBy('appointment.start_time', 'ASC');
    qb.limit(limit);

    return qb.getMany();
  }

  private async listActiveVisits(tenant: TenantContext) {
    const qb = this.visitRepo
      .createQueryBuilder('visit')
      .where('visit.status = :status', { status: 'ONGOING' })
      .andWhere('visit.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere('(visit.organization_id = :orgId OR visit.organization_id IS NULL)', {
        orgId: tenant.organizationId,
      });
    }

    return qb.getMany();
  }

  private async listTodaysVisits(today: string, tenant: TenantContext) {
    const start = new Date(`${today}T00:00:00`);
    const end = new Date(`${today}T23:59:59.999`);
    const qb = this.visitRepo
      .createQueryBuilder('visit')
      .where('visit.start_datetime BETWEEN :start AND :end', { start, end })
      .andWhere('visit.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere('(visit.organization_id = :orgId OR visit.organization_id IS NULL)', {
        orgId: tenant.organizationId,
      });
    }

    return qb.getMany();
  }

  private async countActivePatients(tenant: TenantContext) {
    const qb = this.patientRepo
      .createQueryBuilder('patient')
      .where('patient.is_active = :active', { active: true })
      .andWhere('patient.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere('(patient.organization_id = :orgId OR patient.organization_id IS NULL)', {
        orgId: tenant.organizationId,
      });
    }

    return qb.getCount();
  }

  private async countPendingRequests(tenant: TenantContext) {
    const qb = this.requestRepo
      .createQueryBuilder('request')
      .where('request.status IN (:...statuses)', { statuses: ['REQUESTED', 'IN_PROGRESS'] })
      .andWhere('request.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere('(request.organization_id = :orgId OR request.organization_id IS NULL)', {
        orgId: tenant.organizationId,
      });
    }

    return qb.getCount();
  }

  private computeAverageWaitMinutes(
    appointments: AppointmentOrmEntity[],
    today: string,
    visitStartByAppointmentId: Map<string, Date>,
  ): number {
    const waits: number[] = [];
    for (const a of appointments) {
      if (a.status !== 'CHECKED_IN' && a.status !== 'IN_PROGRESS') continue;
      const visitStart = visitStartByAppointmentId.get(a.id);
      const scheduled = this.parseTime(a.date ?? today, a.startTime);
      if (!scheduled || !visitStart) continue;
      const minutes = Math.round((visitStart.getTime() - scheduled.getTime()) / 60000);
      if (minutes >= 0) waits.push(minutes);
    }
    if (waits.length === 0) return 0;
    return Math.round(waits.reduce((sum, n) => sum + n, 0) / waits.length);
  }

  private parseTime(date: string, time: string): Date | null {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time ?? '');
    if (!match) return null;
    const [_, hours, minutes] = match;
    return new Date(`${date}T${hours}:${minutes}:00`);
  }
}
