import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferralOrmEntity } from '../entities/referral.orm-entity';
import {
  CompleteReferralDto,
  CreateReferralDto,
  DecideReferralDto,
} from '../dto/referral.dto';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';
import { generateNumber } from '../../../shared/utils/numbers';
import { EncountersService } from '../../encounters/services/encounters.service';
import { StaffService } from '../../staff/services/staff.service';

const SORT_ALLOW_LIST = [
  'referralNumber',
  'priority',
  'status',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(ReferralOrmEntity)
    private readonly repo: Repository<ReferralOrmEntity>,
    private readonly encountersService: EncountersService,
    private readonly staffService: StaffService,
  ) {}

  /** Resolve the signed-in user's staff record (id + display name). */
  private async resolveStaff(tenant: TenantContext, user: RequestUser) {
    const staff = await this.staffService
      .list({
        page: 1,
        limit: 1,
        sortBy: 'createdAt',
        sortOrder: 'asc',
        offset: 0,
        userId: user.sub,
      } as ListQueryDto & { userId: string }, tenant)
      .then((page) => page.data[0] ?? null)
      .catch(() => null);
    return staff;
  }

  /**
   * List referrals. `direction= incoming|outgoing` scopes to the specialist
   * respectively the referrer (`providerId`); patients can read referrals
   * tied to them via `patientId`. Also filterable by status.
   */
  async list(
    query: ListQueryDto & {
      status?: string;
      direction?: string;
      providerId?: string;
      patientId?: string;
      encounterId?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('referral')
      .where('referral.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(referral.organization_id = :orgId OR referral.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.status) {
      qb.andWhere('referral.status = :status', { status: query.status });
    }
    if (query.patientId) {
      qb.andWhere('referral.patient_id = :patientId', {
        patientId: query.patientId,
      });
    }
    if (query.encounterId) {
      qb.andWhere('referral.encounter_id = :encounterId', {
        encounterId: query.encounterId,
      });
    }
    if (query.providerId) {
      if (query.direction === 'outgoing') {
        qb.andWhere('referral.referring_provider_id = :providerId', {
          providerId: query.providerId,
        });
      } else if (query.direction === 'incoming') {
        qb.andWhere('referral.specialist_provider_id = :providerId', {
          providerId: query.providerId,
        });
      } else {
        qb.andWhere(
          '(referral.referring_provider_id = :providerId OR referral.specialist_provider_id = :providerId)',
          { providerId: query.providerId },
        );
      }
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    applySort(qb, 'referral', sortBy, query.sortOrder);

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
    dto: CreateReferralDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    // A referral is always rooted in an encounter.
    const encounter = await this.encountersService.get(dto.encounterId, tenant);
    if (encounter.patientId !== dto.patientId) {
      throw new BadRequestException(
        'Encounter belongs to a different patient than the referral',
      );
    }
    const staff = await this.resolveStaff(tenant, user);
    if (dto.specialistProviderId === (staff?.id ?? user.sub)) {
      throw new BadRequestException('Cannot refer a patient to yourself');
    }

    const entity = this.repo.create({
      referralNumber: generateNumber('REF'),
      patientId: dto.patientId,
      patientName: dto.patientName ?? null,
      encounterId: dto.encounterId,
      visitId: dto.visitId ?? encounter.visitId ?? null,
      referringProviderId: staff?.id ?? user.sub,
      referringProviderName: staff
        ? [staff.firstName, staff.lastName].filter(Boolean).join(' ')
        : user.username ?? null,
      specialistProviderId: dto.specialistProviderId,
      specialistProviderName: dto.specialistProviderName ?? null,
      specialty: dto.specialty ?? null,
      reason: dto.reason,
      notes: dto.notes ?? null,
      priority: dto.priority ?? 'ROUTINE',
      status: 'PENDING',
      createdById: user.sub,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  /** Specialist decision: accept or decline a pending referral. */
  async decide(
    id: string,
    dto: DecideReferralDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const referral = await this.findOneScoped(id, tenant);
    if (referral.status !== 'PENDING') {
      throw new BadRequestException(
        `Referral is already ${referral.status.toLowerCase()}`,
      );
    }
    const staff = await this.resolveStaff(tenant, user);
    if (staff) {
      const isParty =
        referral.specialistProviderId === staff.id ||
        referral.referringProviderId === staff.id;
      if (!isParty) {
        throw new BadRequestException(
          'Only the addressed specialist can decide this referral',
        );
      }
    }

    referral.status = dto.decision;
    referral.decisionReason = dto.reason ?? null;
    referral.decisionAt = new Date();
    return this.repo.save(referral);
  }

  /** Specialist completes the consultation the referral asked for. */
  async complete(
    id: string,
    dto: CompleteReferralDto,
    tenant: TenantContext,
    _user: RequestUser,
  ) {
    const referral = await this.findOneScoped(id, tenant);
    if (referral.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Only accepted referrals can be completed',
      );
    }
    referral.status = 'COMPLETED';
    referral.completedAt = new Date();
    if (dto.outcomeNotes) {
      referral.notes = dto.outcomeNotes;
    }
    return this.repo.save(referral);
  }

  async update(
    id: string,
    dto: {
      status?: string;
      notes?: string;
      priority?: string;
      decisionReason?: string;
      completedAt?: string;
    },
    tenant: TenantContext,
  ) {
    const referral = await this.findOneScoped(id, tenant);
    if (dto.notes !== undefined) referral.notes = dto.notes;
    if (dto.priority !== undefined) {
      referral.priority = dto.priority as ReferralOrmEntity['priority'];
    }
    if (dto.decisionReason !== undefined) {
      referral.decisionReason = dto.decisionReason;
    }
    if (dto.completedAt) {
      referral.completedAt = new Date(dto.completedAt);
    }
    if (dto.status) {
      referral.status = dto.status as ReferralOrmEntity['status'];
      if (dto.status === 'COMPLETED' && !referral.completedAt) {
        referral.completedAt = new Date();
      }
    }
    return this.repo.save(referral);
  }

  async remove(id: string, tenant: TenantContext) {
    const referral = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(referral);
    return { ok: true };
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('referral')
      .where('referral.id = :id', { id })
      .andWhere('referral.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(referral.organization_id = :orgId OR referral.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const referral = await qb.getOne();
    if (!referral) {
      throw new NotFoundException('Referral not found');
    }
    return referral;
  }
}
