import axios from 'axios';
import { ExternalNotificationsService } from './external-notifications.service';
import { normalizeNotificationPolicy } from './notification-policy.client';

type DispatchBody = {
  organizationId: string;
  eventKey: string;
  recipients: Record<string, string>;
  context: Record<string, unknown>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  subject?: string;
  message?: string;
  pdfUrl?: string;
};

type PostOptions = { headers: Record<string, string> };

describe('ExternalNotificationsService', () => {
  let config: { get: jest.Mock };
  let policyClient: { get: jest.Mock };
  let patients: { getByPatientId: jest.Mock };
  let post: jest.SpyInstance;
  let service: ExternalNotificationsService;

  const tenant = {
    organizationId: 'org-1',
    locationId: 'loc-1',
    isGlobalAdmin: false,
  };

  const appointment = {
    id: 'appt-1',
    organizationId: 'org-1',
    locationId: 'loc-1',
    appointmentNumber: 'APT-1',
    patientId: 'patient-1',
    patientName: 'Ada Lovelace',
    appointmentType: 'CONSULTATION',
    date: '2026-11-10',
    startTime: '09:00',
    endTime: '09:30',
    providerName: 'Dr Bello',
    status: 'SCHEDULED',
    reason: 'Review',
    scheduleLocation: 'Main clinic',
  };

  const submission = {
    id: 'sub-1',
    organizationId: 'org-1',
    locationId: 'loc-1',
    patientId: 'patient-1',
    formName: 'Discharge summary',
    submissionNumber: 'SUB-1',
    status: 'SUBMITTED',
    submittedByName: 'Dr Bello',
    submittedAt: new Date('2026-11-07T08:00:00.000Z'),
  };

  beforeEach(() => {
    config = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'CONVERSATION_API_URL')
          return 'http://conversation.test/api';
        if (key === 'INTEROP_API_KEY') return 'emr-key';
        return defaultValue;
      }),
    };
    policyClient = {
      get: jest.fn().mockResolvedValue(normalizeNotificationPolicy(null)),
    };
    patients = {
      getByPatientId: jest.fn().mockResolvedValue({
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '+2348000000001',
        email: 'ada@example.com',
      }),
    };
    post = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { sent: 1, deliveries: ['d1'] } });
    service = new ExternalNotificationsService(
      config as never,
      policyClient as never,
      patients as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches an appointment event with recipient + context only', async () => {
    await service.notifyAppointment(appointment as never, 'rescheduled');

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, options] = post.mock.calls[0] as [
      string,
      DispatchBody,
      PostOptions,
    ];
    expect(url).toBe(
      'http://conversation.test/api/notification-dispatch/event',
    );
    expect(options.headers).toMatchObject({ 'x-api-key': 'emr-key' });
    expect(body).toMatchObject({
      organizationId: 'org-1',
      eventKey: 'appointment',
      recipients: { phone: '+2348000000001', email: 'ada@example.com' },
      relatedEntityType: 'Appointment',
      relatedEntityId: 'appt-1',
    });
    expect(body.context).toMatchObject({
      patient_name: 'Ada Lovelace',
      change: 'rescheduled',
      appointment_number: 'APT-1',
      appointment_date: '2026-11-10',
      appointment_time: '09:00',
      appointment_status: 'SCHEDULED',
      provider_name: 'Dr Bello',
      contextId: 'appointment:appt-1:rescheduled',
    });
    // Copy is rendered by conversation from the template.
    expect(body.subject).toBeUndefined();
    expect(body.message).toBeUndefined();
  });

  it('dispatches a document event with the PDF URL', async () => {
    await service.notifyDocumentCreated(
      submission as never,
      tenant,
      'https://cdn.test/sub-1.pdf',
    );

    const [, body] = post.mock.calls[0] as [string, DispatchBody];
    expect(body.eventKey).toBe('document_creation');
    expect(body.pdfUrl).toBe('https://cdn.test/sub-1.pdf');
    expect(body.context).toMatchObject({
      patient_name: 'Ada Lovelace',
      document_name: 'Discharge summary',
      submission_number: 'SUB-1',
      submission_status: 'SUBMITTED',
    });
    expect(body.message).toBeUndefined();
  });

  it('skips dispatch when the organisation has no saved policy', async () => {
    policyClient.get.mockResolvedValue(null);

    await service.notifyAppointment(appointment as never, 'created');

    expect(post).not.toHaveBeenCalled();
  });

  it('skips dispatch when the event is disabled on every usable channel', async () => {
    const policy = normalizeNotificationPolicy(null);
    policy.events.appointment.enabled = false;
    policyClient.get.mockResolvedValue(policy);

    await service.notifyAppointment(appointment as never, 'created');

    expect(post).not.toHaveBeenCalled();
  });

  it('never throws when conversation is unavailable', async () => {
    post.mockRejectedValue(new Error('gateway down'));

    await expect(
      service.notifyAppointment(appointment as never, 'created'),
    ).resolves.toBeUndefined();
  });
});
