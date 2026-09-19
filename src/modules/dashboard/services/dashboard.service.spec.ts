import { DashboardService } from './dashboard.service';
import { repoMock, tenant } from '../../../test-helpers/repo-mock';

describe('DashboardService', () => {
  let service: DashboardService;
  let appointmentRepo: ReturnType<typeof repoMock>;
  let visitRepo: ReturnType<typeof repoMock>;
  let patientRepo: ReturnType<typeof repoMock>;
  let requestRepo: ReturnType<typeof repoMock>;

  const appointment = {
    id: 'apt-1',
    appointmentNumber: 'APT-1',
    patientId: 'patient-1',
    patientName: 'Ada Obi',
    date: '2026-01-05',
    startTime: '09:00',
    status: 'SCHEDULED',
    priority: 'ROUTINE',
    organizationId: 'org-1',
  };

  const visit = {
    id: 'visit-1',
    patientId: 'patient-1',
    status: 'ONGOING',
    providerId: 'staff-1',
    providerName: 'Dr. Ade',
    startDatetime: new Date(),
    appointmentId: null,
    organizationId: 'org-1',
  };

  beforeEach(() => {
    appointmentRepo = repoMock();
    visitRepo = repoMock();
    patientRepo = repoMock();
    requestRepo = repoMock();
    service = new DashboardService(
      appointmentRepo as never,
      visitRepo as never,
      patientRepo as never,
      requestRepo as never,
    );
  });

  it('returns todays schedule with status counts', async () => {
    appointmentRepo.qbState.list = [
      { ...appointment, status: 'SCHEDULED' },
      { ...appointment, id: 'apt-2', status: 'CHECKED_IN' },
      { ...appointment, id: 'apt-3', status: 'IN_PROGRESS' },
      { ...appointment, id: 'apt-4', status: 'COMPLETED' },
      { ...appointment, id: 'apt-5', status: 'CANCELLED' },
      { ...appointment, id: 'apt-6', status: 'NO_SHOW' },
    ];
    visitRepo.qbState.list = [visit];
    patientRepo.qbState.total = 42;
    requestRepo.qbState.total = 7;

    const summary = await service.summary(tenant, '2026-01-05');

    expect(summary.date).toBe('2026-01-05');
    expect(summary.metrics.totalAppointments).toBe(6);
    expect(summary.metrics.scheduled).toBe(1);
    expect(summary.metrics.checkedIn).toBe(2); // CHECKED_IN + IN_PROGRESS
    expect(summary.metrics.inProgress).toBe(1);
    expect(summary.metrics.completed).toBe(1);
    expect(summary.metrics.cancelled).toBe(1);
    expect(summary.metrics.noShow).toBe(1);
  });

  it('reports provider load from active visits', async () => {
    visitRepo.qbState.list = [
      { ...visit, patientId: 'p1' },
      { ...visit, patientId: 'p2' },
      {
        ...visit,
        patientId: 'p3',
        providerId: 'staff-2',
        providerName: 'Dr. Be',
      },
    ];

    const summary = await service.summary(tenant, '2026-01-05');

    expect(summary.metrics.providersOnDuty).toBe(2);
    expect(summary.metrics.activeVisits).toBe(3);
    const top = summary.providerLoad[0];
    expect(top.providerId).toBe('staff-1');
    expect(top.patientCount).toBe(2);
  });

  it('reports independent patient and pending-request counts', async () => {
    appointmentRepo.qbState.list = [];
    visitRepo.qbState.list = [];
    patientRepo.qbState.total = 100;
    requestRepo.qbState.total = 15;

    const summary = await service.summary(tenant, '2026-01-05');

    expect(summary.metrics.totalPatients).toBe(100);
    expect(summary.metrics.pendingRequests).toBe(15);
    expect(summary.metrics.activeVisits).toBe(0);
  });

  it('lists upcoming scheduled appointments', async () => {
    appointmentRepo.qbState.list = [];
    appointmentRepo.qbState.total = 0;
    visitRepo.qbState.list = [];
    visitRepo.qbState.total = 0;
    patientRepo.qbState.total = 0;
    requestRepo.qbState.total = 0;

    await service.summary(tenant, '2026-01-05');

    const qb = appointmentRepo.createQueryBuilder.mock.results;
    const upcomingCalls = qb.filter((r) =>
      (r.value as { orderBy?: jest.Mock })?.orderBy?.mock.calls.some(
        (c: unknown[]) => c[0] === 'appointment.date',
      ),
    );
    expect(upcomingCalls.length).toBeGreaterThan(0);
  });
});
