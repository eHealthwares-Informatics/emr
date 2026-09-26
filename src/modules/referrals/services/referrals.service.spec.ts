import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';

describe('ReferralsService', () => {
  let service: ReferralsService;
  let repo: ReturnType<typeof repoMock>;
  let encountersService: { get: jest.Mock };
  let staffService: { list: jest.Mock };

  const encounter = {
    id: 'enc-1',
    patientId: 'patient-1',
    visitId: 'visit-1',
  };

  const staff = { id: 'staff-dr', firstName: 'Ada', lastName: 'Obi' };

  beforeEach(() => {
    repo = repoMock();
    encountersService = { get: jest.fn().mockResolvedValue(encounter) };
    staffService = { list: jest.fn().mockResolvedValue({ data: [staff] }) };
    service = new ReferralsService(
      repo as never,
      encountersService as never,
      staffService as never,
    );
  });

  describe('list', () => {
    it('returns paginated data', async () => {
      const referral = { id: 'ref-1', status: 'PENDING' };
      repo.qbState.list = [referral];
      repo.qbState.total = 1;
      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [referral],
        total: 1,
      });
    });

    it('scopes outgoing referrals to the referring provider', async () => {
      await service.list(
        listQuery({ direction: 'outgoing', providerId: 'staff-dr' }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        'referral.referring_provider_id = :providerId',
        { providerId: 'staff-dr' },
      );
    });

    it('scopes incoming referrals to the specialist provider', async () => {
      await service.list(
        listQuery({ direction: 'incoming', providerId: 'staff-sp' }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        'referral.specialist_provider_id = :providerId',
        { providerId: 'staff-sp' },
      );
    });

    it('matches either party when no direction is given', async () => {
      await service.list(
        listQuery({ providerId: 'staff-dr' }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(referral.referring_provider_id = :providerId OR referral.specialist_provider_id = :providerId)',
        { providerId: 'staff-dr' },
      );
    });
  });

  describe('create', () => {
    const dto = {
      patientId: 'patient-1',
      patientName: 'Bola Ade',
      encounterId: 'enc-1',
      specialistProviderId: 'staff-sp',
      specialistProviderName: 'Sara Bello',
      specialty: 'CARDIOLOGY',
      reason: 'Chest pain workup',
    };

    it('creates a pending referral rooted in the encounter', async () => {
      const saved = await service.create(dto as never, tenant, user);
      expect(saved.referralNumber).toMatch(/^REF-/);
      expect(saved.status).toBe('PENDING');
      expect(saved.priority).toBe('ROUTINE');
      expect(saved.encounterId).toBe('enc-1');
      expect(saved.visitId).toBe('visit-1');
      expect(saved.referringProviderId).toBe('staff-dr');
      expect(saved.referringProviderName).toBe('Ada Obi');
      expect(saved.createdById).toBe('user-1');
    });

    it('rejects when the encounter belongs to a different patient', async () => {
      encountersService.get.mockResolvedValue({
        ...encounter,
        patientId: 'patient-2',
      });
      await expect(
        service.create(dto as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects a self-referral', async () => {
      await expect(
        service.create(
          { ...dto, specialistProviderId: 'staff-dr' } as never,
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('falls back to the user id when no staff record exists', async () => {
      staffService.list.mockResolvedValue({ data: [] });
      const saved = await service.create(dto as never, tenant, user);
      expect(saved.referringProviderId).toBe('user-1');
      expect(saved.referringProviderName).toBe('dr.ade');
    });
  });

  describe('decide', () => {
    const pending = {
      id: 'ref-1',
      status: 'PENDING',
      specialistProviderId: 'staff-sp',
      referringProviderId: 'staff-dr',
    };

    it('accepts a pending referral addressed to the specialist', async () => {
      repo.qbState.getOne = { ...pending };
      const saved = await service.decide(
        'ref-1',
        { decision: 'ACCEPTED', reason: 'Will see the patient' } as never,
        tenant,
        user,
      );
      expect(saved.status).toBe('ACCEPTED');
      expect(saved.decisionReason).toBe('Will see the patient');
      expect(saved.decisionAt).toBeInstanceOf(Date);
    });

    it('rejects a decision on a non-pending referral', async () => {
      repo.qbState.getOne = { ...pending, status: 'ACCEPTED' };
      await expect(
        service.decide('ref-1', { decision: 'ACCEPTED' } as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a user who is not a party to the referral', async () => {
      repo.qbState.getOne = {
        ...pending,
        specialistProviderId: 'staff-other',
        referringProviderId: 'staff-dr2',
      };
      await expect(
        service.decide('ref-1', { decision: 'DECLINED' } as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('complete', () => {
    it('completes an accepted referral with an outcome', async () => {
      repo.qbState.getOne = {
        id: 'ref-1',
        status: 'ACCEPTED',
        notes: null,
      };
      const saved = await service.complete(
        'ref-1',
        { outcomeNotes: 'Consultation done' } as never,
        tenant,
        user,
      );
      expect(saved.status).toBe('COMPLETED');
      expect(saved.completedAt).toBeInstanceOf(Date);
      expect(saved.notes).toBe('Consultation done');
    });

    it('rejects completing a referral that is not accepted', async () => {
      repo.qbState.getOne = { id: 'ref-1', status: 'PENDING' };
      await expect(
        service.complete('ref-1', {} as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update / remove / get', () => {
    it('updates notes and priority', async () => {
      repo.qbState.getOne = { id: 'ref-1', notes: null, priority: 'ROUTINE' };
      const saved = await service.update(
        'ref-1',
        { notes: 'Bring previous scans', priority: 'URGENT' },
        tenant,
      );
      expect(saved.notes).toBe('Bring previous scans');
      expect(saved.priority).toBe('URGENT');
    });

    it('stamps completedAt when completed through a status update', async () => {
      repo.qbState.getOne = { id: 'ref-1', status: 'ACCEPTED', completedAt: null };
      const saved = await service.update('ref-1', { status: 'COMPLETED' }, tenant);
      expect(saved.completedAt).toBeInstanceOf(Date);
    });

    it('soft-removes a referral', async () => {
      repo.qbState.getOne = { id: 'ref-1' };
      await expect(service.remove('ref-1', tenant)).resolves.toEqual({
        ok: true,
      });
    });

    it('throws NotFound for a missing referral', async () => {
      repo.qbState.getOne = null;
      await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
