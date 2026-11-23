import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PatientOrmEntity } from '../entities/patient.orm-entity';
import { PatientsService } from './patients.service';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../../common/tenant-context';

/** Everything the caller knows about the patient they are acting as. */
export type PatientIdentity = {
  /** Identity user id (`sub` claim). Preferred link. */
  userId?: string | null;
  /** Conversation-engine participant id. */
  participantId?: string | null;
  /** Phone number as a last-resort link. */
  phone?: string | null;
  /** Optional name, used only when creating the record. */
  firstName?: string | null;
  lastName?: string | null;
};

/**
 * Resolves the patient behind a signed-in caller.
 *
 * A patient can arrive three ways, and the strongest available link wins:
 * `userId` (identity account) → `participantId` (chat participant) → `phone`.
 * When none match, a record is created and stamped with every identifier that
 * was supplied, so the next call resolves on the strongest one.
 */
@Injectable()
export class PatientIdentityService {
  private readonly logger = new Logger(PatientIdentityService.name);

  constructor(
    @InjectRepository(PatientOrmEntity)
    private readonly repo: Repository<PatientOrmEntity>,
    private readonly patientsService: PatientsService,
  ) {}

  async resolve(
    identity: PatientIdentity,
    tenant: TenantContext,
    user: RequestUser,
  ): Promise<PatientOrmEntity> {
    const userId = this.clean(identity.userId);
    const participantId = this.clean(identity.participantId);
    const phone = this.clean(identity.phone);

    const existing =
      (phone && (await this.findByPhone(phone))) ||
      (participantId && (await this.find({ participantId }))) ||
      (userId && (await this.find({ userId: userId })));

    if (existing) {
      // Backfill links learned since the record was created (e.g. the patient
      // has now signed in, so the phone record gains a userId).
      const patch: Partial<PatientOrmEntity> = {};
      if (userId && !existing.userId) patch.userId = userId;
      if (participantId && !existing.participantId) {
        patch.participantId = participantId;
      }
      if (Object.keys(patch).length) {
        await this.repo.update(existing.id, patch);
        Object.assign(existing, patch);
      }
      return existing;
    }

    if (!userId && !participantId && !phone) {
      // Nothing to link on: a patient-scoped route cannot guess an identity.
      throw new Error('No patient identity supplied');
    }

    this.logger.log(
      `[patient-identity] creating patient for userId=${userId ?? '-'} participant=${participantId ?? '-'} phone=${phone ? '***' : '-'}`,
    );

    const created = await this.patientsService.create(
      {
        firstName: this.clean(identity.firstName) ?? 'Patient',
        lastName:
          this.clean(identity.lastName) ??
          (phone ? phone.slice(-4) : 'Unknown'),
        phone: phone ?? null,
      } as any,
      tenant,
      user,
    );

    await this.repo.update(created.id, {
      userId: userId ?? null,
      participantId: participantId ?? null,
    });
    return { ...created, userId: userId ?? null, participantId };
  }

  /**
   * Match on the phone's digits, not the stored formatting.
   *
   * Numbers arrive as `23480…`, `+23480…` or `080…` depending on the caller, so
   * an exact string match silently misses every record stored in another shape.
   */
  private async findByPhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    return this.repo
      .createQueryBuilder('patient')
      .where('patient.deleted_at IS NULL')
      .andWhere(
        "regexp_replace(coalesce(patient.phone, ''), '\\D', '', 'g') = :digits",
        { digits },
      )
      .limit(1)
      .getOne();
  }

  private find(where: Record<string, unknown>) {
    return this.repo.findOne({
      where: { ...where, deletedAt: IsNull() },
    });
  }

  private clean(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
}
