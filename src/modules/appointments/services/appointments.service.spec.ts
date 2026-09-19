import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let repo: ReturnType<typeof repoMock>;
  let visitsService: { create: jest.Mock };

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

  beforeEach(() => {
    repo = repoMock();
    visitsService = { create: jest.fn() };
    service = new AppointmentsService(repo as never, visitsService as never);
  });

  describe('list', () => {
    it('returns paginated data', async () => {
      repo.qbState.list = [appointment];
      repo.qbState.total = 1;
      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [appointment],
        total: 1,
      });
    });

    it('filters by status, date and provider', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({
          status: 'SCHEDULED',
          date: '2026-01-05',
          providerId: 'staff-1',
        }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith('appointment.status = :status', {
        status: 'SCHEDULED',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('appointment.date = :date', {
        date: '2026-01-05',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'appointment.provider_id = :providerId',
        { providerId: 'staff-1' },
      );
    });

    it('applies DSL date filters (EQUALS) through the filter engine', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(listQuery({ date: 'EQUALS|2026-01-05|' }), tenant);
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringMatching(/^appointment\.date = :/),
        expect.any(Object),
      );
      expect(qb.andWhere).not.toHaveBeenCalledWith('appointment.date = :date', {
        date: 'EQUALS|2026-01-05|',
      });
    });

    it('applies DSL date BETWEEN filters', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({ date: 'BETWEEN|2026-01-01|2026-01-31' }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringMatching(/^appointment\.date BETWEEN :/),
        expect.any(Object),
      );
    });

    it('filters by patient free-text against name or MRN', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({ patientName: 'FUZZY_MATCH|ada|' }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(appointment.patient_name ILIKE :p OR appointment.patient_id ILIKE :p)',
        { p: '%ada%' },
      );
    });
  });

  describe('create', () => {
    it('creates a SCHEDULED appointment with a generated number', async () => {
      const saved = await service.create(
        {
          patientId: 'patient-1',
          patientName: 'Ada Obi',
          date: '2026-01-05',
        } as never,
        tenant,
        user,
      );
      expect(saved.appointmentNumber).toMatch(/^APT-/);
      expect(saved.status).toBe('SCHEDULED');
      expect(saved.priority).toBe('ROUTINE');
      expect(saved.organizationId).toBe('org-1');
    });
  });

  describe('checkIn', () => {
    it('creates a visit and moves the appointment to IN_PROGRESS', async () => {
      repo.qbState.getOne = { ...appointment };
      visitsService.create.mockResolvedValue({ id: 'visit-9' });

      const result = await service.checkIn('apt-1', {}, tenant, user);

      expect(visitsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'patient-1',
          appointmentId: 'apt-1',
        }),
        tenant,
        user,
      );
      expect(result.appointment.status).toBe('IN_PROGRESS');
      expect(result.appointment.visitId).toBe('visit-9');
      expect(result.visit).toEqual({ id: 'visit-9' });
    });

    it('rejects check-in for a completed appointment', async () => {
      repo.qbState.getOne = { ...appointment, status: 'COMPLETED' };
      await expect(
        service.checkIn('apt-1', {}, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('transition / cancel', () => {
    it('marks a scheduled appointment as NO_SHOW', async () => {
      repo.qbState.getOne = { ...appointment };
      const saved = await service.transition('apt-1', 'NO_SHOW', tenant);
      expect(saved.status).toBe('NO_SHOW');
    });

    it('only completes in-progress appointments', async () => {
      repo.qbState.getOne = { ...appointment, status: 'SCHEDULED' };
      await expect(
        service.transition('apt-1', 'COMPLETED', tenant),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cancels with a reason stored in notes', async () => {
      repo.qbState.getOne = { ...appointment };
      const saved = await service.cancel(
        'apt-1',
        { reason: 'Patient unavailable' },
        tenant,
      );
      expect(saved.status).toBe('CANCELLED');
      expect(saved.notes).toBe('Patient unavailable');
    });

    it('rejects cancelling an already closed appointment', async () => {
      repo.qbState.getOne = { ...appointment, status: 'COMPLETED' };
      await expect(service.cancel('apt-1', {}, tenant)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('rejects editing completed or cancelled appointments', async () => {
      repo.qbState.getOne = { ...appointment, status: 'COMPLETED' };
      await expect(
        service.update('apt-1', { startTime: '10:00' }, tenant),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies edits to schedulable appointments', async () => {
      repo.qbState.getOne = { ...appointment };
      const saved = await service.update(
        'apt-1',
        { startTime: '10:00' },
        tenant,
      );
      expect(saved.startTime).toBe('10:00');
    });
  });

  it('throws NotFound for a missing appointment', async () => {
    repo.qbState.getOne = null;
    await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
