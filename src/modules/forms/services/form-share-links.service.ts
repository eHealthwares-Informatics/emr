import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { PatientsService } from '../../patients/services/patients.service';
import { FormDefinitionOrmEntity } from '../entities/form-definition.orm-entity';
import { FormShareLinkOrmEntity } from '../entities/form-share-link.orm-entity';
import { FormSubmissionOrmEntity } from '../entities/form-submission.orm-entity';
import { CreateFormShareLinkDto } from '../dto/share.dto';
import { FormDefinitionsService } from './form-definitions.service';
import { FormSubmissionsService } from './form-submissions.service';

export type PatientProofPayload = {
  typ: 'form-patient';
  linkId: string;
  patientId: string;
};

@Injectable()
export class FormShareLinksService {
  constructor(
    @InjectRepository(FormShareLinkOrmEntity)
    private readonly repo: Repository<FormShareLinkOrmEntity>,
    @InjectRepository(FormSubmissionOrmEntity)
    private readonly submissionRepo: Repository<FormSubmissionOrmEntity>,
    private readonly formDefinitions: FormDefinitionsService,
    private readonly formSubmissions: FormSubmissionsService,
    private readonly patients: PatientsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async create(
    formDefinitionId: string,
    dto: CreateFormShareLinkDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const form = await this.formDefinitions.get(formDefinitionId, tenant);
    if (!form.isPublished) {
      throw new BadRequestException(
        'Publish the form before creating share links',
      );
    }

    let patientId = dto.patientId ?? null;
    let submissionId = dto.submissionId ?? null;

    if (submissionId) {
      const submission = await this.formSubmissions.get(submissionId, tenant);
      if (submission.formDefinitionId !== formDefinitionId) {
        throw new BadRequestException(
          'Submission does not belong to this form',
        );
      }
      patientId = submission.patientId ?? patientId;
      if (!patientId) {
        throw new BadRequestException(
          'Cannot create an instance link for an anonymous submission',
        );
      }
    }

    if (patientId) {
      await this.patients.getByPatientId(patientId, tenant);
    }

    const mode =
      dto.mode ?? (patientId || submissionId ? 'instance' : 'template');
    if (mode === 'instance' && !patientId) {
      throw new BadRequestException(
        'Instance links require a patient or submission',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      Date.now() + (dto.expiresInHours ?? 48) * 60 * 60 * 1000,
    );

    const saved = await this.repo.save(
      this.repo.create({
        tokenHash,
        formDefinitionId,
        patientId,
        submissionId,
        mode,
        expiresAt,
        maxUses: null,
        usedCount: 0,
        revokedAt: null,
        createdById: user.sub,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      }),
    );

    return {
      id: saved.id,
      token,
      url: this.publicUrl(token),
      mode,
      formDefinitionId,
      patientId,
      submissionId,
      expiresAt,
    };
  }

  async resolve(token: string): Promise<FormShareLinkOrmEntity> {
    if (!token) {
      throw new UnauthorizedException('Form link is missing');
    }
    const link = await this.repo.findOne({
      where: { tokenHash: this.hashToken(token), deletedAt: IsNull() },
    });
    if (!link) {
      throw new NotFoundException('Form link is invalid');
    }
    if (link.revokedAt) {
      throw new UnauthorizedException('Form link has been revoked');
    }
    if (link.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Form link has expired');
    }
    if (link.maxUses != null && link.usedCount >= link.maxUses) {
      throw new UnauthorizedException('Form link has already been used');
    }
    return link;
  }

  tenantFor(link: FormShareLinkOrmEntity): TenantContext {
    return {
      organizationId: link.organizationId,
      locationId: link.locationId,
      isGlobalAdmin: !link.organizationId,
    };
  }

  async markUsed(link: FormShareLinkOrmEntity): Promise<void> {
    await this.repo.update({ id: link.id }, { usedCount: link.usedCount + 1 });
  }

  /** Point an instance link at the latest submission (including amendments). */
  async setSubmission(linkId: string, submissionId: string): Promise<void> {
    await this.repo.update({ id: linkId }, { submissionId });
  }

  /** Latest submission for a patient/form pair (used when a link has no submission id). */
  async latestSubmission(
    formDefinitionId: string,
    patientId: string | null,
    tenant: TenantContext,
  ): Promise<FormSubmissionOrmEntity | null> {
    if (!patientId) {
      return null;
    }
    const qb = this.submissionRepo
      .createQueryBuilder('submission')
      .where('submission.form_definition_id = :formDefinitionId', {
        formDefinitionId,
      })
      .andWhere('submission.patient_id = :patientId', { patientId })
      .andWhere('submission.deleted_at IS NULL')
      .orderBy('submission.created_at', 'DESC');

    if (tenant.organizationId) {
      qb.andWhere(
        '(submission.organization_id = :orgId OR submission.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }
    return qb.getOne();
  }

  signPatientProof(
    link: FormShareLinkOrmEntity,
    patientId: string,
  ): string {
    return this.jwt.sign(
      {
        typ: 'form-patient',
        linkId: link.id,
        patientId,
      } satisfies PatientProofPayload,
      {
        secret: this.proofSecret(),
        expiresIn: '30m',
      },
    );
  }

  verifyPatientProof(
    token: string,
    link: FormShareLinkOrmEntity,
  ): string {
    try {
      const payload = this.jwt.verify<PatientProofPayload>(token, {
        secret: this.proofSecret(),
      });
      if (
        payload.typ !== 'form-patient' ||
        payload.linkId !== link.id ||
        !payload.patientId
      ) {
        throw new Error('invalid proof');
      }
      return payload.patientId;
    } catch {
      throw new UnauthorizedException('Patient verification has expired');
    }
  }

  async getForm(
    link: FormShareLinkOrmEntity,
  ): Promise<FormDefinitionOrmEntity> {
    return this.formDefinitions.get(
      link.formDefinitionId,
      this.tenantFor(link),
    );
  }

  private publicUrl(token: string): string {
    const base = this.config
      .get<string>('PUBLIC_WEB_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');
    return `${base}/f/${token}`;
  }

  private proofSecret(): string {
    const secret =
      this.config.get<string>('FORM_PROOF_SECRET') ??
      this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('FORM_PROOF_SECRET or JWT_ACCESS_SECRET is required');
    }
    return secret;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
