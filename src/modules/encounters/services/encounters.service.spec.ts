import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EncountersService } from './encounters.service';
import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';

describe('EncountersService', () => {
  let service: EncountersService;
  let repo: ReturnType<typeof repoMock>;
  let visitsService: { get: jest.Mock };
  let requestsService: { create: jest.Mock };
  let patientsService: { getByPatientId: jest.Mock };

  const encounter = {
    id: 'enc-1',
    encounterNumber: 'ENC-1',
    patientId: 'patient-1',
    encounterType: 'CONSULTATION',
    encounterDatetime: new Date('2026-01-01T09:00:00Z'),
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    visitsService = { get: jest.fn() };
    requestsService = { create: jest.fn() };
    patientsService = { getByPatientId: jest.fn() };
    service = new EncountersService(
      repo as never,
      visitsService as never,
      requestsService as never,
      patientsService as never,
    );
  });

  describe('list', () => {
    it('returns paginated data', async () => {
      repo.qbState.list = [encounter];
      repo.qbState.total = 1;
      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [encounter],
        total: 1,
      });
    });

    it('filters by patient, visit and type', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({
          patientId: 'patient-1',
          visitId: 'visit-1',
          encounterType: 'CONSULTATION',
        }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        'encounter.patient_id = :patientId',
        {
          patientId: 'patient-1',
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'encounter.visit_id = :visitId',
        {
          visitId: 'visit-1',
        },
      );
    });
  });

  describe('create', () => {
    it('creates an encounter with a generated number and timestamp', async () => {
      const saved = await service.create(
        { patientId: 'patient-1', encounterType: 'CONSULTATION' } as never,
        tenant,
        user,
      );
      expect(saved.encounterNumber).toMatch(/^ENC-/);
      expect(saved.encounterDatetime).toBeInstanceOf(Date);
      expect(saved.createdById).toBe('user-1');
      // New encounters start ACTIVE unless a status is provided.
      expect(saved.status).toBe('ACTIVE');
    });

    it('creates an encounter with the provided status', async () => {
      const saved = await service.create(
        {
          patientId: 'patient-1',
          encounterType: 'CONSULTATION',
          status: 'COMPLETED',
        } as never,
        tenant,
        user,
      );
      expect(saved.status).toBe('COMPLETED');
    });

    it('rejects a visit belonging to a different patient', async () => {
      visitsService.get.mockResolvedValue({
        id: 'visit-1',
        patientId: 'patient-2',
        status: 'ONGOING',
      });
      await expect(
        service.create(
          { patientId: 'patient-1', visitId: 'visit-1' } as never,
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects adding an encounter to a closed visit', async () => {
      visitsService.get.mockResolvedValue({
        id: 'visit-1',
        patientId: 'patient-1',
        status: 'COMPLETED',
      });
      await expect(
        service.create(
          { patientId: 'patient-1', visitId: 'visit-1' } as never,
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createRequest', () => {
    it('prefills patient/encounter/visit and delegates to RequestsService', async () => {
      repo.qbState.getOne = {
        ...encounter,
        patientId: 'MRN-100',
        visitId: 'visit-1',
      };
      patientsService.getByPatientId.mockResolvedValue({
        firstName: 'Ada',
        lastName: 'Obi',
      });
      requestsService.create.mockResolvedValue({ id: 'req-1' });

      const result = await service.createRequest(
        'enc-1',
        { requestType: 'LAB', items: [] } as never,
        tenant,
        user,
      );

      expect(requestsService.create).toHaveBeenCalledWith(
        {
          requestType: 'LAB',
          items: [],
          patientId: 'MRN-100',
          patientName: 'Ada Obi',
          encounterId: 'enc-1',
          visitId: 'visit-1',
        },
        tenant,
        user,
        undefined,
      );
      expect(result).toEqual({ id: 'req-1' });
    });

    it('throws NotFound when the encounter does not resolve', async () => {
      repo.qbState.getOne = null;
      await expect(
        service.createRequest('missing', { items: [] } as never, tenant, user),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(requestsService.create).not.toHaveBeenCalled();
    });
  });

  describe('update / remove', () => {
    it('updates an encounter', async () => {
      repo.qbState.getOne = { ...encounter };
      const saved = await service.update(
        'enc-1',
        { reason: 'Follow-up' },
        tenant,
      );
      expect(saved.reason).toBe('Follow-up');
    });

    it('soft-removes an encounter', async () => {
      repo.qbState.getOne = encounter;
      await expect(service.remove('enc-1', tenant)).resolves.toEqual({
        ok: true,
      });
    });

    it('throws NotFound for a missing encounter', async () => {
      repo.qbState.getOne = null;
      await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
