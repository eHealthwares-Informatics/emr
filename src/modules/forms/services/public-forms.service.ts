import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { PatientsService } from '../../patients/services/patients.service';
import { FormDefinitionOrmEntity } from '../entities/form-definition.orm-entity';
import { FormShareLinkOrmEntity } from '../entities/form-share-link.orm-entity';
import { FormSubmissionOrmEntity } from '../entities/form-submission.orm-entity';
import {
  PublicSubmitFormDto,
  RequestPatientOtpDto,
  VerifyPatientOtpDto,
} from '../dto/share.dto';
import { FormShareLinksService } from './form-share-links.service';
import { FormSubmissionsService } from './form-submissions.service';
import { PatientOtpService } from './patient-otp.service';

@Injectable()
export class PublicFormsService {
  constructor(
    private readonly shareLinks: FormShareLinksService,
    private readonly formSubmissions: FormSubmissionsService,
    private readonly patients: PatientsService,
    private readonly otp: PatientOtpService,
  ) {}

  async get(token: string) {
    const link = await this.shareLinks.resolve(token);
    const tenant = this.shareLinks.tenantFor(link);
    const form = await this.resolveForm(link, tenant);

    const submission = link.submissionId
      ? await this.formSubmissions.get(link.submissionId, tenant)
      : await this.shareLinks.latestSubmission(
          link.formDefinitionId,
          link.patientId,
          tenant,
        );

    const patient = link.patientId
      ? await this.patients.getByPatientId(link.patientId, tenant)
      : null;

    return {
      link: {
        id: link.id,
        mode: link.mode,
        expiresAt: link.expiresAt,
      },
      form: {
        id: form.id,
        code: form.code,
        name: form.name,
        description: form.description,
        eventKey: form.eventKey,
        schemaJson: form.schemaJson,
      },
      patient: patient
        ? {
            patientId: patient.patientId,
            name: this.maskName(patient.firstName, patient.lastName),
          }
        : null,
      submission: submission
        ? {
            id: submission.id,
            submissionNumber: submission.submissionNumber,
            status: submission.status,
            formVersion: submission.formVersion,
            dataJson: submission.dataJson,
            amendedFromId: submission.amendedFromId,
          }
        : null,
    };
  }

  async submit(token: string, dto: PublicSubmitFormDto) {
    const link = await this.shareLinks.resolve(token);
    const tenant = this.shareLinks.tenantFor(link);
    const form = await this.resolveForm(link, tenant);

    const patientId = await this.resolvePatientId(link, dto, form);
    const patient = patientId
      ? await this.patients.getByPatientId(patientId, tenant)
      : null;
    const userName = patient
      ? [patient.firstName, patient.lastName].filter(Boolean).join(' ') ||
        'Patient'
      : 'Patient';
    const publicUser: RequestUser = {
      sub: 'public',
      organizationId: link.organizationId,
      locationId: link.locationId,
      username: userName,
      roles: [],
      permissions: [],
    };

    const existing = link.submissionId
      ? await this.formSubmissions.get(link.submissionId, tenant)
      : await this.shareLinks.latestSubmission(
          link.formDefinitionId,
          patientId,
          tenant,
        );

    let saved: FormSubmissionOrmEntity;
    if (existing && existing.status === 'DRAFT') {
      saved = await this.formSubmissions.update(
        existing.id,
        { dataJson: dto.dataJson, status: 'SUBMITTED' },
        tenant,
      );
    } else if (existing) {
      saved = await this.formSubmissions.amend(
        existing.id,
        { dataJson: dto.dataJson },
        tenant,
        publicUser,
      );
    } else {
      saved = await this.formSubmissions.create(
        {
          formDefinitionId: form.id,
          patientId: patientId ?? undefined,
          dataJson: dto.dataJson,
          status: 'SUBMITTED',
        },
        tenant,
        publicUser,
      );
    }

    await this.shareLinks.markUsed(link);
    if (link.patientId) {
      await this.shareLinks.setSubmission(link.id, saved.id);
    }
    return { submission: saved };
  }

  async requestOtp(token: string, dto: RequestPatientOtpDto) {
    const link = await this.shareLinks.resolve(token);
    return this.otp.requestOtp(
      dto,
      this.shareLinks.tenantFor(link),
      null,
      link,
    );
  }

  async verifyOtp(token: string, dto: VerifyPatientOtpDto) {
    const link = await this.shareLinks.resolve(token);
    return this.otp.verifyOtp(dto, this.shareLinks.tenantFor(link), link);
  }

  async verifyIdentity(token: string, dto: RequestPatientOtpDto) {
    const link = await this.shareLinks.resolve(token);
    return this.otp.verifyIdentity(
      dto,
      this.shareLinks.tenantFor(link),
      link,
    );
  }

  private async resolveForm(
    link: FormShareLinkOrmEntity,
    tenant: ReturnType<FormShareLinksService['tenantFor']>,
  ): Promise<FormDefinitionOrmEntity> {
    const form = await this.shareLinks.getForm(link);
    if (!form.isPublished) {
      throw new BadRequestException('This form is not accepting responses');
    }
    return form;
  }

  /**
   * Instance links carry their patient. Template links may carry a verified
   * patient proof (OTP) or an auth-patient/patient field value; otherwise the
   * submission is anonymous.
   */
  private async resolvePatientId(
    link: FormShareLinkOrmEntity,
    dto: PublicSubmitFormDto,
    form: FormDefinitionOrmEntity,
  ): Promise<string | null> {
    if (link.patientId) {
      return link.patientId;
    }
    if (dto.patientProof) {
      return this.shareLinks.verifyPatientProof(dto.patientProof, link);
    }

    const fields: Array<{ type: string; key: string }> = [];
    const walk = (list: FormDefinitionOrmEntity['schemaJson']['fields'] = []) => {
      for (const field of list) {
        fields.push({ type: field.type, key: field.key });
        if (field.fields?.length) {
          walk(field.fields);
        }
      }
    };
    walk(form.schemaJson?.fields ?? []);

    for (const field of fields) {
      if (field.type !== 'auth-patient' && field.type !== 'patient') {
        continue;
      }
      const value = dto.dataJson?.[field.key] as
        | Record<string, unknown>
        | undefined;
      if (!value) {
        continue;
      }
      if (field.type === 'auth-patient') {
        if (typeof value.proof === 'string') {
          return this.shareLinks.verifyPatientProof(value.proof, link);
        }
        throw new UnauthorizedException(
          'Patient verification is required for this form',
        );
      }
      if (typeof value.patientId === 'string') {
        return value.patientId;
      }
    }
    return null;
  }

  private maskName(first?: string | null, last?: string | null): string {
    const mask = (value?: string | null) =>
      value?.trim()
        ? `${value.trim().charAt(0).toUpperCase()}***`
        : '';
    return [mask(first), mask(last)].filter(Boolean).join(' ') || 'Patient';
  }
}
