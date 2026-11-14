import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { PatientsService } from '../../patients/services/patients.service';
import { NotificationClientService } from '../../notifications/services/notification-client.service';
import { PatientOtpChallengeOrmEntity } from '../entities/patient-otp-challenge.orm-entity';
import { FormShareLinkOrmEntity } from '../entities/form-share-link.orm-entity';
import {
  RequestPatientOtpDto,
  VerifyPatientOtpDto,
} from '../dto/share.dto';
import { FormShareLinksService } from './form-share-links.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

@Injectable()
export class PatientOtpService {
  constructor(
    @InjectRepository(PatientOtpChallengeOrmEntity)
    private readonly repo: Repository<PatientOtpChallengeOrmEntity>,
    private readonly patients: PatientsService,
    private readonly notifications: NotificationClientService,
    private readonly shareLinks: FormShareLinksService,
  ) {}

  async requestOtp(
    dto: RequestPatientOtpDto,
    tenant: TenantContext,
    user: RequestUser | null,
    link?: FormShareLinkOrmEntity,
  ) {
    const patient = await this.findPatient(dto, tenant);

    const recent = await this.repo.findOne({
      where: {
        patientId: patient.patientId,
        consumedAt: IsNull(),
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
    if (
      recent &&
      recent.expiresAt.getTime() > Date.now() &&
      recent.createdAt.getTime() > Date.now() - OTP_RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException(
        'A code was just sent. Wait a moment before requesting another.',
      );
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const challenge = await this.repo.save(
      this.repo.create({
        patientId: patient.patientId,
        phone: dto.phone.trim(),
        codeHash: this.hashCode(code, patient.patientId),
        expiresAt,
        attempts: 0,
        consumedAt: null,
        shareLinkId: link?.id ?? null,
        requestedById: user?.sub ?? null,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      }),
    );

    await this.notifications.dispatchPayload({
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      eventKey: 'patient_otp',
      channels: ['sms'],
      recipients: { phone: dto.phone.trim() },
      message: `Your verification code is ${code}. It expires in 5 minutes.`,
      context: {
        patient_name: [patient.firstName, patient.lastName]
          .filter(Boolean)
          .join(' '),
        purpose: 'patient_verification',
      },
      relatedEntityType: 'PatientOtpChallenge',
      relatedEntityId: challenge.id,
    });

    return {
      challengeId: challenge.id,
      expiresAt,
      patient: this.patientSummary(patient),
    };
  }

  async verifyOtp(
    dto: VerifyPatientOtpDto,
    tenant: TenantContext,
    link?: FormShareLinkOrmEntity,
  ) {    const challenge = await this.repo.findOne({
      where: { id: dto.challengeId, deletedAt: IsNull() },
    });
    if (!challenge) {
      throw new NotFoundException('Verification code not found');
    }
    if (
      tenant.organizationId &&
      challenge.organizationId &&
      challenge.organizationId !== tenant.organizationId
    ) {
      throw new NotFoundException('Verification code not found');
    }
    if (link && challenge.shareLinkId !== link.id) {
      throw new UnauthorizedException('Verification code does not match link');
    }
    if (challenge.consumedAt) {
      throw new UnauthorizedException('Verification code was already used');
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Verification code has expired');
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many attempts');
    }

    const expected = this.hashCode(dto.code.trim(), challenge.patientId);
    if (expected !== challenge.codeHash) {
      challenge.attempts += 1;
      await this.repo.save(challenge);
      throw new UnauthorizedException('Incorrect verification code');
    }

    challenge.consumedAt = new Date();
    await this.repo.save(challenge);

    const patient = await this.patients.getByPatientId(
      challenge.patientId,
      tenant,
    );

    return {
      patient: this.patientSummary(patient),
      patientId: challenge.patientId,
      patientProof: link
        ? this.shareLinks.signPatientProof(link, challenge.patientId)
        : null,
    };
  }

  /**
   * Verify a patient without an OTP using phone + MRN/date of birth. Used as the
   * alternate AuthPatientPicker path.
   */
  async verifyIdentity(
    dto: RequestPatientOtpDto,
    tenant: TenantContext,
    link?: FormShareLinkOrmEntity,
  ) {
    if (!dto.mrn && !dto.dateOfBirth) {
      throw new BadRequestException(
        'Provide the MRN or date of birth to verify without a code',
      );
    }
    const patient = await this.findPatient(dto, tenant);
    return {
      patient: this.patientSummary(patient),
      patientId: patient.patientId,
      patientProof: link
        ? this.shareLinks.signPatientProof(link, patient.patientId)
        : null,
    };
  }

  private async findPatient(
    dto: RequestPatientOtpDto,
    tenant: TenantContext,
  ) {
    const phone = dto.phone.trim();
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }

    if (dto.mrn) {
      const patient = await this.patients.getByPatientId(dto.mrn, tenant);
      this.assertPhoneMatch(patient.phone, phone);
      this.assertDobMatch(patient.dateOfBirth, dto.dateOfBirth);
      return patient;
    }

    const query = Object.assign(new ListQueryDto(), {
      search: phone,
      limit: 50,
      page: 1,
    });
    const result = await this.patients.list(query, tenant);
    const matches = result.data.filter(
      (patient) => this.normalizePhone(patient.phone) === this.normalizePhone(phone),
    );

    if (matches.length === 1) {
      this.assertDobMatch(matches[0].dateOfBirth, dto.dateOfBirth);
      return matches[0];
    }
    if (matches.length > 1) {
      throw new BadRequestException(
        'Multiple patients share this phone. Provide the MRN to continue.',
      );
    }
    throw new NotFoundException('No patient found for this phone number');
  }

  private assertPhoneMatch(
    stored: string | null | undefined,
    provided: string,
  ) {
    if (this.normalizePhone(stored) !== this.normalizePhone(provided)) {
      throw new UnauthorizedException('Phone number does not match the patient');
    }
  }

  private assertDobMatch(
    stored: string | null | undefined,
    provided?: string,
  ) {
    if (!provided) {
      return;
    }
    if (!stored || stored.slice(0, 10) !== provided.slice(0, 10)) {
      throw new UnauthorizedException('Date of birth does not match');
    }
  }

  private patientSummary(patient: {
    patientId: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    dateOfBirth: string | null;
  }) {
    return {
      patientId: patient.patientId,
      name: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
      phone: patient.phone,
      email: patient.email,
      dateOfBirth: patient.dateOfBirth,
    };
  }

  private normalizePhone(value: string | null | undefined): string {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.slice(-10);
  }

  private hashCode(code: string, patientId: string): string {
    return createHash('sha256')
      .update(`${patientId}:${code}`)
      .digest('hex');
  }
}
