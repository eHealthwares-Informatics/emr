import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdmissionOrmEntity } from '../entities/admission.orm-entity';
import {
  AdmitFromVisitDto,
  AdmitPatientDto,
  DischargeDto,
  TransferAdmissionDto,
  UpdateAdmissionDto,
} from '../dto/admission.dto';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort, dslFilterValue } from '../../../database/list';
import { generateNumber } from '../../../shared/utils/numbers';
import { WardsService } from '../../wards/services/wards.service';
import { BedsService } from '../../beds/services/beds.service';
import { VisitsService } from '../../visits/services/visits.service';
import { VisitOrmEntity } from '../../visits/entities/visit.orm-entity';

const SORT_ALLOW_LIST = [
  'admissionNumber',
  'patientName',
  'admissionType',
  'status',
  'admissionDatetime',
  'dischargeDatetime',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class AdmissionsService {
  constructor(
    @InjectRepository(AdmissionOrmEntity)
    private readonly repo: Repository<AdmissionOrmEntity>,
    private readonly wardsService: WardsService,
    private readonly bedsService: BedsService,
    private readonly visitsService: VisitsService,
  ) {}

  async list(
    query: ListQueryDto & {
      status?: string;
      admissionType?: string;
      wardId?: string;
      patientId?: string;
      bedId?: string;
      visitId?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('admission')
      .leftJoinAndMapOne(
        'admission.visit',
        VisitOrmEntity,
        'visit',
        // visit_id is a text column (codebase convention); visits.id is uuid.
        'visit.id = CAST(admission.visit_id AS uuid) AND visit.deleted_at IS NULL',
      )
      .where('admission.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(admission.organization_id = :orgId OR admission.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(admission.patient_name ILIKE :search OR admission.patient_id ILIKE :search OR admission.admission_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    const status = dslFilterValue(query.status);
    if (status) {
      qb.andWhere('admission.status = :status', { status });
    }
    const admissionType = dslFilterValue(query.admissionType);
    if (admissionType) {
      qb.andWhere('admission.admission_type = :admissionType', {
        admissionType,
      });
    }
    const wardId = dslFilterValue(query.wardId);
    if (wardId) {
      qb.andWhere('admission.ward_id = :wardId', { wardId });
    }
    const patientId = dslFilterValue(query.patientId);
    if (patientId) {
      qb.andWhere('admission.patient_id = :patientId', { patientId });
    }
    const bedId = dslFilterValue(query.bedId);
    if (bedId) {
      qb.andWhere('admission.bed_id = :bedId', { bedId });
    }
    const visitId = dslFilterValue(query.visitId);
    if (visitId) {
      qb.andWhere('admission.visit_id = :visitId', { visitId });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'admissionDatetime';
    applySort(qb, 'admission', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();
    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  async admit(dto: AdmitPatientDto, tenant: TenantContext, user: RequestUser) {
    if (dto.wardId) {
      await this.wardsService.get(dto.wardId, tenant);
    }
    if (dto.bedId) {
      const bed = await this.bedsService.assertBedAvailable(dto.bedId, tenant);
      if (dto.wardId && bed.wardId !== dto.wardId) {
        throw new BadRequestException(
          'Bed does not belong to the selected ward',
        );
      }
    }

    // Admissions extend a visit: reuse the supplied visit or auto-create an
    // inpatient visit so encounters/requests always have a home.
    const admissionDatetime = dto.admissionDatetime
      ? new Date(dto.admissionDatetime)
      : new Date();
    let visitId = dto.visitId ?? null;
    if (visitId) {
      await this.visitsService.get(visitId, tenant);
      await this.assertVisitNotAdmitted(visitId, tenant);
    } else {
      const visit = await this.visitsService.create(
        {
          patientId: dto.patientId,
          patientName: dto.patientName,
          visitType: 'INPATIENT',
          providerId: dto.referringProviderId,
          providerName: dto.referringProviderName,
          startDatetime: admissionDatetime.toISOString(),
        },
        tenant,
        user,
      );
      visitId = visit.id;
    }

    const entity = this.repo.create({
      patientId: dto.patientId,
      patientName: dto.patientName,
      wardId: dto.wardId ?? null,
      bedId: dto.bedId ?? null,
      admissionDatetime,
      admissionType: dto.admissionType ?? 'ELECTIVE',
      diagnosis: dto.diagnosis ?? null,
      referringProviderId: dto.referringProviderId ?? null,
      referringProviderName: dto.referringProviderName ?? null,
      status: 'ADMITTED',
      dischargeDatetime: null,
      dischargeType: null,
      dischargeSummary: null,
      notes: dto.notes ?? null,
      admissionNumber: generateNumber('ADM'),
      visitId,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      createdById: user.sub,
    });
    const saved = await this.repo.save(entity);

    if (saved.bedId) {
      await this.bedsService.setStatus(saved.bedId, 'OCCUPIED', tenant);
    }

    return saved;
  }

  /**
   * Convert an ongoing visit into an inpatient admission: the admission links
   * to the existing visit (encounters/requests follow), and the visit becomes
   * an INPATIENT visit.
   */
  async admitFromVisit(
    visitId: string,
    dto: AdmitFromVisitDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const visit = await this.visitsService.get(visitId, tenant);
    if (visit.status !== 'ONGOING') {
      throw new BadRequestException(
        'Only ongoing visits can be converted to an admission',
      );
    }
    await this.assertVisitNotAdmitted(visitId, tenant);

    if (dto.wardId) {
      await this.wardsService.get(dto.wardId, tenant);
    }
    if (dto.bedId) {
      const bed = await this.bedsService.assertBedAvailable(dto.bedId, tenant);
      if (dto.wardId && bed.wardId !== dto.wardId) {
        throw new BadRequestException(
          'Bed does not belong to the selected ward',
        );
      }
    }

    const entity = this.repo.create({
      patientId: visit.patientId,
      patientName: visit.patientName,
      wardId: dto.wardId ?? null,
      bedId: dto.bedId ?? null,
      admissionDatetime: new Date(),
      admissionType: dto.admissionType ?? 'ELECTIVE',
      diagnosis: dto.diagnosis ?? null,
      referringProviderId: visit.providerId,
      referringProviderName: visit.providerName,
      status: 'ADMITTED',
      dischargeDatetime: null,
      dischargeType: null,
      dischargeSummary: null,
      notes: dto.notes ?? null,
      admissionNumber: generateNumber('ADM'),
      visitId,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      createdById: user.sub,
    });
    const saved = await this.repo.save(entity);

    if (saved.bedId) {
      await this.bedsService.setStatus(saved.bedId, 'OCCUPIED', tenant);
    }

    const updatedVisit = await this.visitsService.update(
      visitId,
      { visitType: 'INPATIENT' },
      tenant,
    );

    return { admission: saved, visit: updatedVisit };
  }

  /** Rejects converting a visit that already has an active admission. */
  private async assertVisitNotAdmitted(visitId: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('admission')
      .where('admission.visit_id = :visitId', { visitId })
      .andWhere('admission.status = :status', { status: 'ADMITTED' })
      .andWhere('admission.deleted_at IS NULL');
    if (tenant.organizationId) {
      qb.andWhere(
        '(admission.organization_id = :orgId OR admission.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }
    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException(
        `Visit already has an active admission (${existing.admissionNumber})`,
      );
    }
  }

  async update(id: string, dto: UpdateAdmissionDto, tenant: TenantContext) {
    const admission = await this.findOneScoped(id, tenant);
    if (admission.status !== 'ADMITTED') {
      throw new BadRequestException('Only active admissions can be updated');
    }
    if (dto.wardId) {
      await this.wardsService.get(dto.wardId, tenant);
    }
    if (dto.bedId && dto.bedId !== admission.bedId) {
      const bed = await this.bedsService.assertBedAvailable(dto.bedId, tenant);
      if (dto.wardId && bed.wardId !== dto.wardId) {
        throw new BadRequestException(
          'Bed does not belong to the selected ward',
        );
      }
      if (admission.bedId) {
        await this.bedsService.setStatus(admission.bedId, 'AVAILABLE', tenant);
      }
      await this.bedsService.setStatus(dto.bedId, 'OCCUPIED', tenant);
    }
    if (dto.admissionDatetime) {
      admission.admissionDatetime = new Date(dto.admissionDatetime);
      delete dto.admissionDatetime;
    }
    Object.assign(admission, dto);
    return this.repo.save(admission);
  }

  async transfer(id: string, dto: TransferAdmissionDto, tenant: TenantContext) {
    const admission = await this.findOneScoped(id, tenant);
    if (admission.status !== 'ADMITTED') {
      throw new BadRequestException(
        'Only active admissions can be transferred',
      );
    }
    const nextWardId = dto.wardId ?? admission.wardId;
    if (nextWardId) {
      await this.wardsService.get(nextWardId, tenant);
    }
    if (dto.bedId) {
      const bed = await this.bedsService.assertBedAvailable(dto.bedId, tenant);
      if (nextWardId && bed.wardId !== nextWardId) {
        throw new BadRequestException('Bed does not belong to the target ward');
      }
      if (admission.bedId) {
        await this.bedsService.setStatus(admission.bedId, 'AVAILABLE', tenant);
      }
      await this.bedsService.setStatus(dto.bedId, 'OCCUPIED', tenant);
    } else if (admission.bedId) {
      await this.bedsService.setStatus(admission.bedId, 'AVAILABLE', tenant);
    }

    admission.wardId = nextWardId;
    admission.bedId = dto.bedId ?? null;
    admission.status = 'TRANSFERRED';
    return this.repo.save(admission);
  }

  async discharge(id: string, dto: DischargeDto, tenant: TenantContext) {
    const admission = await this.findOneScoped(id, tenant);
    if (admission.status !== 'ADMITTED') {
      throw new BadRequestException('Only active admissions can be discharged');
    }
    admission.status = 'DISCHARGED';
    admission.dischargeDatetime = dto.dischargeDatetime
      ? new Date(dto.dischargeDatetime)
      : new Date();
    admission.dischargeType = dto.dischargeType ?? 'DISCHARGED_HOME';
    if (dto.dischargeSummary !== undefined) {
      admission.dischargeSummary = dto.dischargeSummary;
    }
    const saved = await this.repo.save(admission);

    if (saved.bedId) {
      await this.bedsService.setStatus(saved.bedId, 'AVAILABLE', tenant);
    }

    // The stay is over: end the visit the admission extends.
    if (saved.visitId) {
      try {
        await this.visitsService.end(saved.visitId, {}, tenant);
      } catch {
        // Visit may already be completed/cancelled — discharge still stands.
      }
    }
    return saved;
  }

  async remove(id: string, tenant: TenantContext) {
    const admission = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(admission);
    return { ok: true };
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('admission')
      .where('admission.id = :id', { id })
      .andWhere('admission.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(admission.organization_id = :orgId OR admission.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const admission = await qb.getOne();
    if (!admission) {
      throw new NotFoundException('Admission not found');
    }
    return admission;
  }
}
