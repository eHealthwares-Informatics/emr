import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VisitsService } from './visits.service';
import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';

describe('VisitsService', () => {
  let service: VisitsService;
  let repo: ReturnType<typeof repoMock>;

  const visit = {
    id: 'visit-1',
    visitNumber: 'VIS-1',
    patientId: 'patient-1',
    patientName: 'Ada Obi',
    visitType: 'OUTPATIENT',
    status: 'ONGOING',
    startDatetime: new Date('2026-01-01T09:00:00Z'),
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    service = new VisitsService(repo as never);
  });

  describe('list / active', () => {
    it('returns paginated data', async () => {
      repo.qbState.list = [visit];
      repo.qbState.total = 1;
      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [visit],
        total: 1,
      });
    });

    it('filters by status, provider and patient', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({
          status: 'ONGOING',
          providerId: 'staff-1',
          patientId: 'patient-1',
        }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith('visit.status = :status', {
        status: 'ONGOING',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'visit.provider_id = :providerId',
        {
          providerId: 'staff-1',
        },
      );
    });

    it('lists only ongoing visits for the active board', async () => {
      repo.qbState.list = [visit];
      repo.qbState.total = 1;
      const result = await service.active(tenant);
      expect(result.data).toEqual([visit]);
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.where).toHaveBeenCalledWith('visit.status = :status', {
        status: 'ONGOING',
      });
    });
  });

  describe('create / update', () => {
    it('creates an ongoing visit with a generated number', async () => {
      const dto = { patientId: 'patient-1', visitType: 'OUTPATIENT' };
      const saved = await service.create(dto as never, tenant, user);
      expect(saved.visitNumber).toMatch(/^VIS-/);
      expect(saved.status).toBe('ONGOING');
      expect(saved.patientName).toBe('patient-1');
      expect(saved.organizationId).toBe('org-1');
    });

    it('updates a visit', async () => {
      repo.qbState.getOne = { ...visit };
      const saved = await service.update(
        'visit-1',
        { visitType: 'INPATIENT' } as never,
        tenant,
      );
      expect(saved.visitType).toBe('INPATIENT');
    });
  });

  describe('end / cancel', () => {
    it('completes a visit with a stop datetime', async () => {
      repo.qbState.getOne = { ...visit };
      const saved = await service.end('visit-1', {}, tenant);
      expect(saved.status).toBe('COMPLETED');
      expect(saved.stopDatetime).toBeInstanceOf(Date);
    });

    it('rejects completing an already completed visit', async () => {
      repo.qbState.getOne = { ...visit, status: 'COMPLETED' };
      await expect(service.end('visit-1', {}, tenant)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('cancels only ongoing visits', async () => {
      repo.qbState.getOne = { ...visit };
      const saved = await service.cancel('visit-1', tenant);
      expect(saved.status).toBe('CANCELLED');

      repo.qbState.getOne = { ...visit, status: 'COMPLETED' };
      await expect(service.cancel('visit-1', tenant)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  it('throws NotFound for a missing visit', async () => {
    repo.qbState.getOne = null;
    await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
