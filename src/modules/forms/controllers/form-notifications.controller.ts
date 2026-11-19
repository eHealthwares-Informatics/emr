import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';
import { PatientsService } from '../../patients/services/patients.service';
import { NotificationClientService } from '../../notifications/services/notification-client.service';
import { FormDefinitionOrmEntity } from '../entities/form-definition.orm-entity';
import { FormSubmissionOrmEntity } from '../entities/form-submission.orm-entity';
import { DispatchFormNotificationDto, ShareFormLinkDto } from '../dto/share.dto';
import { FormDefinitionsService } from '../services/form-definitions.service';
import { FormShareLinksService } from '../services/form-share-links.service';
import { FormSubmissionsService } from '../services/form-submissions.service';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Print/Send proxy. Builds the template context from a submission (or the
 * caller's context) and forwards to conversation's notification dispatch.
 * The response includes the generated print artifacts so the UI can open them.
 */
@ApiTags('form-notifications')
@Controller('form-notifications')
export class FormNotificationsController {
  constructor(
    private readonly formDefinitions: FormDefinitionsService,
    private readonly formSubmissions: FormSubmissionsService,
    private readonly shareLinks: FormShareLinksService,
    private readonly patients: PatientsService,
    private readonly notifications: NotificationClientService,
  ) {}

  @Post('share')
  @ApiOperation({
    summary: 'Create a public form link and send it by email/SMS',
  })
  async share(
    @Body() dto: ShareFormLinkDto,
    @CurrentUser() user: RequestUser,
  ) {
    const tenant = tenantFromUser(user);
    const link = await this.shareLinks.create(
      dto.formDefinitionId,
      {
        patientId: dto.patientId,
        submissionId: dto.submissionId,
        mode: dto.patientId || dto.submissionId ? 'instance' : 'template',
      },
      tenant,
      user,
    );

    const patientId = dto.patientId ?? link.patientId ?? null;
    const patient = patientId
      ? await this.patients.getByPatientId(patientId, tenant).catch(() => null)
      : null;
    const form = await this.formDefinitions.get(dto.formDefinitionId, tenant);

    const dispatch = await this.notifications.dispatchPayload({
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      eventKey: 'form_share_link',
      channels: dto.channels?.length ? dto.channels : ['email', 'sms'],
      recipients: {
        phone: dto.phone ?? patient?.phone ?? null,
        email: dto.email ?? patient?.email ?? null,
      },
      subject: `Form: ${form.name}`,
      message: `Please complete "${form.name}" using this link: ${link.url}`,
      html: `<p>Please complete <strong>${escapeHtml(form.name)}</strong> using the link below.</p><p><a href="${escapeHtml(link.url)}">Open the form</a></p><p>This link expires ${link.expiresAt.toLocaleString()}.</p>`,
      context: {
        form_name: form.name,
        form_link: link.url,
        patient_name: patient
          ? [patient.firstName, patient.lastName].filter(Boolean).join(' ')
          : null,
      },
      relatedEntityType: 'FormDefinition',
      relatedEntityId: form.id,
    });

    return { link, dispatch };
  }

  @Post('send')
  @ApiOperation({
    summary: 'Dispatch a form notification (print and/or email/SMS)',
  })
  async send(
    @Body() dto: DispatchFormNotificationDto,
    @CurrentUser() user: RequestUser,
  ) {
    const tenant = tenantFromUser(user);

    let submission: FormSubmissionOrmEntity | null = null;
    let form: FormDefinitionOrmEntity | null = null;
    if (dto.submissionId) {
      submission = await this.formSubmissions.get(dto.submissionId, tenant);
      form = await this.formDefinitions.get(
        submission.formDefinitionId,
        tenant,
      );
    } else if (dto.formDefinitionId) {
      form = await this.formDefinitions.get(dto.formDefinitionId, tenant);
    }

    const patient = submission?.patientId
      ? await this.patients
          .getByPatientId(submission.patientId, tenant)
          .catch(() => null)
      : null;

    const context = {
      ...(dto.context ?? {}),
      ...(submission?.dataJson ?? {}),
      patient_name: patient
        ? [patient.firstName, patient.lastName].filter(Boolean).join(' ')
        : null,
      patient_mrn: submission?.patientId ?? null,
      patient_phone: patient?.phone ?? null,
      patient_email: patient?.email ?? null,
      patient_dob: patient?.dateOfBirth ?? null,
      patient_gender: patient?.gender ?? null,
      form_name: form?.name ?? null,
      form_code: form?.code ?? null,
      form_event_key: form?.eventKey ?? null,
      submission_number: submission?.submissionNumber ?? null,
      submission_status: submission?.status ?? null,
      submitted_by: submission?.submittedByName ?? null,
      submitted_at: submission?.submittedAt ?? null,
      organization_id: tenant.organizationId,
      location_id: tenant.locationId,
      sender_user_id: user.sub,
      sender_username: user.username,
    };

    const eventKey =
      dto.eventKey ?? form?.eventKey ?? 'document_creation';

    return this.notifications.dispatch({
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      eventKey,
      context,
      recipients: dto.recipients,
      printFormat: dto.printFormat ?? null,
      relatedEntityType: submission ? 'FormSubmission' : 'FormDefinition',
      relatedEntityId: submission?.id ?? form?.id ?? null,
    });
  }
}
