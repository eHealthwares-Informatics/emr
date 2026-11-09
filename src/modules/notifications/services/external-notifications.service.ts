import { Injectable, Logger } from '@nestjs/common';
import type { TenantContext } from '../../../common/tenant-context';
import type { AppointmentOrmEntity } from '../../appointments/entities/appointment.orm-entity';
import type { FormSubmissionOrmEntity } from '../../forms/entities/form-submission.orm-entity';
import { PatientsService } from '../../patients/services/patients.service';
import { NotificationClientService } from './notification-client.service';

export type NotificationRecipient = {
  phone?: string | null;
  email?: string | null;
};

export type NotificationEventDispatch = {
  /** Notification event key resolved by the conversation engine. */
  eventCode: string;
  organizationId: string;
  locationId?: string | null;
  /** Where to deliver. Empty values are ignored. */
  recipient: NotificationRecipient;
  /** Template variables rendered by the conversation engine. */
  context?: Record<string, unknown>;
  /** Hosted PDF/document URL. When present conversation uses the media path. */
  pdfUrl?: string | null;
  pdfFileName?: string | null;
  pdfMimeType?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  /** Stable id forwarded to conversation for exchange dedupe. */
  contextId?: string | null;
};

/**
 * Patient-facing appointment/document notifications.
 *
 * Callers only supply the event code, recipient, context (template variables)
 * and an optional document URL. The conversation notification engine owns the
 * template, channel selection and delivery ledger — this service never builds
 * message copy.
 *
 * Delivery stays opt-in: when the organisation has never saved a notification
 * policy, or the event is disabled on every channel that has a recipient, the
 * notification is skipped.
 */
@Injectable()
export class ExternalNotificationsService {
  private readonly logger = new Logger(ExternalNotificationsService.name);

  constructor(
    private readonly patients: PatientsService,
    private readonly client: NotificationClientService,
  ) {}

  async notifyAppointment(
    appointment: AppointmentOrmEntity,
    change:
      | 'created'
      | 'updated'
      | 'rescheduled'
      | 'checked_in'
      | 'cancelled'
      | 'no_show'
      | 'completed',
  ): Promise<void> {
    if (!appointment.organizationId) return;

    const patient = await this.resolvePatient(appointment.patientId, {
      organizationId: appointment.organizationId,
      locationId: appointment.locationId ?? null,
      isGlobalAdmin: false,
    });
    const patientName = patient
      ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() ||
        appointment.patientName ||
        'Patient'
      : appointment.patientName || 'Patient';

    await this.dispatch({
      eventCode: 'appointment',
      organizationId: appointment.organizationId,
      locationId: appointment.locationId ?? null,
      recipient: {
        phone: patient?.phone ?? null,
        email: patient?.email ?? null,
      },
      context: {
        patient_name: patientName,
        change,
        appointment_number: appointment.appointmentNumber,
        appointment_date: appointment.date,
        appointment_time: appointment.startTime,
        appointment_end_time: appointment.endTime,
        appointment_type: appointment.appointmentType,
        appointment_status: appointment.status,
        provider_name: appointment.providerName,
        reason: appointment.reason,
        location: appointment.scheduleLocation,
      },
      relatedEntityType: 'Appointment',
      relatedEntityId: appointment.id,
      contextId: `appointment:${appointment.id}:${change}`,
    });
  }

  async notifyDocumentCreated(
    submission: FormSubmissionOrmEntity,
    tenant: TenantContext,
    pdfUrl?: string | null,
  ): Promise<void> {
    if (submission.status === 'DRAFT') return;

    const organizationId = submission.organizationId ?? tenant.organizationId;
    if (!organizationId) return;

    const patient = await this.resolvePatient(submission.patientId, tenant);
    const patientName = patient
      ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() ||
        'Patient'
      : 'Patient';

    await this.dispatch({
      eventCode: 'document_creation',
      organizationId,
      locationId: submission.locationId ?? tenant.locationId,
      recipient: {
        phone: patient?.phone ?? null,
        email: patient?.email ?? null,
      },
      context: {
        patient_name: patientName,
        document_name: submission.formName,
        form_name: submission.formName,
        submission_number: submission.submissionNumber,
        submission_status: submission.status,
        submitted_by: submission.submittedByName,
        submitted_at: submission.submittedAt,
      },
      pdfUrl,
      pdfFileName: pdfUrl ? `${submission.formName}.pdf` : null,
      relatedEntityType: 'FormSubmission',
      relatedEntityId: submission.id,
      contextId: `document:${submission.id}`,
    });
  }

  /**
   * Sends one notification event to the conversation engine. Conversation
   * resolves the event template and channels, renders the context and records
   * each delivery — EMR sends only the event key, recipients and context.
   */
  async dispatch(input: NotificationEventDispatch): Promise<void> {
    if (!input.organizationId) return;
    if (!input.recipient.phone && !input.recipient.email) return;

    try {
      // Route through the shared client so the dispatch is recorded on the
      // EMR sender-app ledger (and can be re-triggered from the UI).
      await this.client.dispatch({
        source: 'external',
        organizationId: input.organizationId,
        locationId: input.locationId ?? null,
        eventKey: input.eventCode,
        recipients: {
          phone: input.recipient.phone ?? undefined,
          email: input.recipient.email ?? undefined,
        },
        context: {
          source: 'emr-notification',
          eventType: input.eventCode,
          locationId: input.locationId ?? null,
          relatedEntityType: input.relatedEntityType ?? null,
          relatedEntityId: input.relatedEntityId ?? null,
          contextId: input.contextId ?? null,
          ...input.context,
        },
        pdfUrl: input.pdfUrl ?? null,
        pdfFileName: input.pdfFileName ?? null,
        pdfMimeType: input.pdfMimeType ?? 'application/pdf',
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
      });
    } catch (error: unknown) {
      this.logger.warn(
        `EMR ${input.eventCode} notification failed for ${input.relatedEntityType ?? 'entity'}/${input.relatedEntityId ?? 'unknown'}: ${(error as Error)?.message ?? error}`,
      );
    }
  }

  private async resolvePatient(patientId: string, tenant: TenantContext) {
    if (!patientId) return null;
    try {
      return await this.patients.getByPatientId(patientId, tenant);
    } catch (error: unknown) {
      this.logger.debug(
        `Patient lookup failed for ${patientId}: ${(error as Error)?.message ?? error}`,
      );
      return null;
    }
  }
}
