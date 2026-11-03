import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { TenantContext } from '../../../common/tenant-context';
import type { AppointmentOrmEntity } from '../../appointments/entities/appointment.orm-entity';
import type { FormSubmissionOrmEntity } from '../../forms/entities/form-submission.orm-entity';
import { PatientsService } from '../../patients/services/patients.service';
import {
  isChannelEnabled,
  isEventChannelEnabled,
  NotificationPolicyClient,
  resolveChannelCode,
  resolveFallbackChannel,
  type NotificationPolicyChannel,
  type NotificationPolicyEvent,
} from './notification-policy.client';

type DeliveryInput = {
  event: NotificationPolicyEvent;
  organizationId: string;
  locationId?: string | null;
  phone?: string | null;
  email?: string | null;
  title: string;
  body: string;
  relatedEntityType: string;
  relatedEntityId: string;
  contextId: string;
  context?: Record<string, unknown>;
};

/**
 * Patient-facing appointment/document notifications.
 *
 * Delivery is opt-in: when the organisation has never saved a notification
 * policy the service stays silent, so turning this on cannot surprise existing
 * facilities. Each send honours the global channel switch, the event switch,
 * the per-event channel selection, and the channel's one-hop fallback.
 */
@Injectable()
export class ExternalNotificationsService {
  private readonly logger = new Logger(ExternalNotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly policyClient: NotificationPolicyClient,
    private readonly patients: PatientsService,
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
        'Patient'
      : appointment.patientName || 'Patient';

    const when = [appointment.date, appointment.startTime]
      .filter(Boolean)
      .join(' ');
    const state =
      change === 'created'
        ? `is scheduled for ${when}`
        : change === 'rescheduled'
          ? `has been moved to ${when}`
          : change === 'checked_in'
            ? 'has been checked in'
            : change === 'cancelled'
              ? 'has been cancelled'
              : change === 'no_show'
                ? 'was marked as a no-show'
                : change === 'completed'
                  ? 'is complete'
                  : 'has been updated';

    await this.deliver({
      event: 'appointment',
      organizationId: appointment.organizationId,
      locationId: appointment.locationId ?? null,
      phone: patient?.phone ?? null,
      email: patient?.email ?? null,
      title: `Appointment ${appointment.appointmentNumber}`,
      body: `Hello ${patientName}, your appointment ${appointment.appointmentNumber} ${state}.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: appointment.id,
      contextId: `appointment:${appointment.id}:${change}`,
      context: {
        appointmentNumber: appointment.appointmentNumber,
        appointmentDate: appointment.date,
        appointmentTime: appointment.startTime,
        status: appointment.status,
      },
    });
  }

  async notifyDocumentCreated(
    submission: FormSubmissionOrmEntity,
    tenant: TenantContext,
  ): Promise<void> {
    if (submission.status === 'DRAFT') return;

    const organizationId = submission.organizationId ?? tenant.organizationId;
    if (!organizationId) return;

    const patient = await this.resolvePatient(submission.patientId, tenant);
    const patientName = patient
      ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() ||
        'Patient'
      : 'Patient';

    await this.deliver({
      event: 'document_creation',
      organizationId,
      locationId: submission.locationId ?? tenant.locationId,
      phone: patient?.phone ?? null,
      email: patient?.email ?? null,
      title: 'New clinical document',
      body: `Hello ${patientName}, a new clinical document (${submission.formName}, ${submission.submissionNumber}) has been added to your record.`,
      relatedEntityType: 'FormSubmission',
      relatedEntityId: submission.id,
      contextId: `document:${submission.id}`,
      context: {
        formName: submission.formName,
        submissionNumber: submission.submissionNumber,
      },
    });
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

  private async deliver(input: DeliveryInput): Promise<void> {
    const policy = await this.policyClient.get(input.organizationId);
    // Never send until an admin has saved a policy for the organisation.
    if (!policy) return;

    const channels: NotificationPolicyChannel[] = ['whatsapp', 'sms', 'email'];
    for (const channel of channels) {
      if (!isChannelEnabled(policy, channel)) continue;
      if (!isEventChannelEnabled(policy, input.event, channel)) continue;

      const recipient = channel === 'email' ? input.email : input.phone;
      if (!recipient) continue;

      const ok = await this.send(
        channel,
        resolveChannelCode(policy, channel, this.defaultCode(channel)),
        recipient,
        input,
      );
      if (ok) continue;

      const fallback = resolveFallbackChannel(policy, channel);
      if (!fallback) continue;
      if (!isChannelEnabled(policy, fallback)) continue;
      if (!isEventChannelEnabled(policy, input.event, fallback)) continue;

      const fallbackRecipient =
        fallback === 'email' ? input.email : input.phone;
      if (!fallbackRecipient) continue;

      await this.send(
        fallback,
        resolveChannelCode(policy, fallback, this.defaultCode(fallback)),
        fallbackRecipient,
        input,
      );
    }
  }

  private defaultCode(channel: NotificationPolicyChannel): string {
    const key =
      channel === 'whatsapp'
        ? 'EMR_WHATSAPP_CHANNEL_CODE'
        : channel === 'email'
          ? 'EMR_EMAIL_CHANNEL_CODE'
          : 'EMR_SMS_CHANNEL_CODE';
    return this.config.get<string>(key, `EMR_${channel.toUpperCase()}`);
  }

  private async send(
    channel: NotificationPolicyChannel,
    code: string,
    recipient: string,
    input: DeliveryInput,
  ): Promise<boolean> {
    if (!code) return false;

    try {
      const baseUrl = this.config.get<string>(
        'CONVERSATION_API_URL',
        'http://localhost:8090/api',
      );
      const apiKey = this.config.get<string>('INTERNAL_API_KEY', '');
      await axios.post(
        `${baseUrl.replace(/\/+$/, '')}/channels/${encodeURIComponent(code)}/send-message`,
        {
          title: input.title,
          message: input.body,
          phone: channel === 'email' ? undefined : recipient,
          email: channel === 'email' ? recipient : undefined,
          context: {
            source: 'emr-notification',
            eventType: input.event,
            relatedEntityType: input.relatedEntityType,
            relatedEntityId: input.relatedEntityId,
            contextId: input.contextId,
            ...input.context,
          },
        },
        {
          headers: apiKey ? { 'x-api-key': apiKey } : undefined,
          timeout: 10_000,
        },
      );
      return true;
    } catch (error: unknown) {
      this.logger.warn(
        `EMR ${channel} notification failed for ${input.relatedEntityType}/${input.relatedEntityId}: ${(error as Error)?.message ?? error}`,
      );
      return false;
    }
  }
}
