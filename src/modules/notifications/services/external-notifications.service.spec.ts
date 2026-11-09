import { ExternalNotificationsService } from './external-notifications.service';

describe('ExternalNotificationsService', () => {
  let patients: { getByPatientId: jest.Mock };
  let client: { dispatch: jest.Mock };
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
    patients = {
      getByPatientId: jest.fn().mockResolvedValue({
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '+2348000000001',
        email: 'ada@example.com',
      }),
    };
    client = {
      dispatch: jest
        .fn()
        .mockResolvedValue({ ok: true, sent: 1, failed: 0, skipped: 0, deliveries: ['d1'] }),
    };
    service = new ExternalNotificationsService(patients as never, client as never);
  });

  it('dispatches an appointment event with recipient + context only', async () => {
    await service.notifyAppointment(appointment as never, 'rescheduled');

    expect(client.dispatch).toHaveBeenCalledTimes(1);
    const payload = client.dispatch.mock.calls[0][0];
    expect(payload).toMatchObject({
      organizationId: 'org-1',
      eventKey: 'appointment',
      recipients: { phone: '+2348000000001', email: 'ada@example.com' },
      relatedEntityType: 'Appointment',
      relatedEntityId: 'appt-1',
    });
    expect(payload.context).toMatchObject({
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
    expect(payload.subject).toBeUndefined();
    expect(payload.message).toBeUndefined();
    expect(payload.channels).toBeUndefined();
  });

  it('dispatches a document event with the PDF URL', async () => {
    await service.notifyDocumentCreated(
      submission as never,
      tenant,
      'https://cdn.test/sub-1.pdf',
    );

    const payload = client.dispatch.mock.calls[0][0];
    expect(payload.eventKey).toBe('document_creation');
    expect(payload.pdfUrl).toBe('https://cdn.test/sub-1.pdf');
    expect(payload.context).toMatchObject({
      patient_name: 'Ada Lovelace',
      document_name: 'Discharge summary',
      submission_number: 'SUB-1',
      submission_status: 'SUBMITTED',
    });
    expect(payload.message).toBeUndefined();
    expect(payload.channels).toBeUndefined();
  });

  it('skips dispatch when there is no recipient', async () => {
    patients.getByPatientId.mockResolvedValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: null,
      email: null,
    });

    await service.notifyAppointment(appointment as never, 'created');

    expect(client.dispatch).not.toHaveBeenCalled();
  });

  it('never throws when conversation is unavailable', async () => {
    client.dispatch.mockRejectedValue(new Error('gateway down'));

    await expect(
      service.notifyAppointment(appointment as never, 'created'),
    ).resolves.toBeUndefined();
  });
});
