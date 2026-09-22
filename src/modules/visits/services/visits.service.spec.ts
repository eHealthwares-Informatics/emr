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
  let commentsRepo: ReturnType<typeof repoMock>;

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
    commentsRepo = repoMock();
    service = new VisitsService(repo as never, commentsRepo as never);
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

  describe('createdAt filter', () => {
    it('expands createdAt BETWEEN filters to full-day ranges', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({ createdAt: 'BETWEEN|2026-01-01|2026-01-31' }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      const betweenCall = qb.andWhere.mock.calls.find(([sql]: [string]) =>
        String(sql).startsWith('visit.createdAt BETWEEN'),
      );
      expect(betweenCall).toBeDefined();
      expect(Object.values(betweenCall[1])).toEqual(
        expect.arrayContaining(['2026-01-01 00:00:00', '2026-01-31 23:59:59.999']),
      );
    });
  });

  describe('comments', () => {
    it('adds a comment with the requesting user as author fallback', async () => {
      repo.qbState.getOne = { ...visit };
      const saved = await service.addComment(
        'visit-1',
        { comment: 'Patient resting well' } as never,
        tenant,
        user,
      );
      expect(saved.visitId).toBe('visit-1');
      expect(saved.comment).toBe('Patient resting well');
      expect(saved.authorName).toBe(user.username);
      expect(commentsRepo.create).toHaveBeenCalled();
      expect(commentsRepo.save).toHaveBeenCalled();
    });

    it('lists comments ordered oldest first', async () => {
      repo.qbState.getOne = { ...visit };
      const comment = { id: 'c-1', comment: 'Note', visitId: 'visit-1' };
      commentsRepo.qbState.list = [comment];
      const result = await service.listComments('visit-1', tenant);
      expect(result).toEqual([comment]);
      const qb = commentsRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.where).toHaveBeenCalledWith('comment.visit_id = :visitId', {
        visitId: 'visit-1',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('comment.created_at', 'ASC');
    });

    it('rejects comments for a missing visit', async () => {
      repo.qbState.getOne = null;
      await expect(
        service.addComment('missing', { comment: 'x' } as never, tenant, user),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
