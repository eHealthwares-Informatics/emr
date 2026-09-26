import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MedicationsService } from './medications.service';
import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';

describe('MedicationsService', () => {
  let service: MedicationsService;
  let repo: ReturnType<typeof repoMock>;
  let requestsService: { get: jest.Mock; transition: jest.Mock };

  const prescriptionItem = {
    name: 'Paracetamol',
    dose: '500',
    doseUnit: 'mg',
    route: 'ORAL',
    frequency: 'TDS',
    duration: '5',
    durationUnit: 'DAYS',
    quantity: 15,
    instructions: 'After meals',
  };

  const prescriptionRequest = {
    id: 'req-1',
    requestType: 'PRESCRIPTION',
    status: 'PENDING',
    patientId: 'patient-1',
    patientName: 'Bola Ade',
    encounterId: 'enc-1',
    visitId: 'visit-1',
    items: [prescriptionItem],
  };

  beforeEach(() => {
    repo = repoMock();
    requestsService = {
      get: jest.fn().mockResolvedValue(prescriptionRequest),
      transition: jest.fn().mockResolvedValue({ id: 'req-1' }),
    };
    service = new MedicationsService(repo as never, requestsService as never);
  });

  describe('list', () => {
    it('returns paginated data', async () => {
      const medication = { id: 'med-1', status: 'PRESCRIBED' };
      repo.qbState.list = [medication];
      repo.qbState.total = 1;
      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [medication],
        total: 1,
      });
    });

    it('filters by request, status and administration state', async () => {
      await service.list(
        listQuery({
          requestId: 'req-1',
          status: 'PRESCRIBED',
          administered: 'true',
        }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith('medication.request_id = :requestId', {
        requestId: 'req-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('medication.status = :status', {
        status: 'PRESCRIBED',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'medication.administered_at IS NOT NULL',
      );
    });
  });

  describe('create', () => {
    const dto = { requestId: 'req-1', itemIndex: 0 };

    it('creates a medication from a prescription item with item defaults', async () => {
      const saved = await service.create(dto as never, tenant, user);
      expect(saved.medicationNumber).toMatch(/^MED-/);
      expect(saved.status).toBe('PRESCRIBED');
      expect(saved.requestId).toBe('req-1');
      expect(saved.patientId).toBe('patient-1');
      expect(saved.encounterId).toBe('enc-1');
      expect(saved.name).toBe('Paracetamol');
      expect(saved.dose).toBe('500');
      expect(saved.route).toBe('ORAL');
      expect(saved.quantity).toBe(15);
      expect(saved.createdById).toBe('user-1');
    });

    it('allows overriding item values through the dto', async () => {
      const saved = await service.create(
        { ...dto, dose: '1000', quantity: 30 } as never,
        tenant,
        user,
      );
      expect(saved.dose).toBe('1000');
      expect(saved.quantity).toBe(30);
      expect(saved.name).toBe('Paracetamol');
    });

    it('rejects non-PRESCRIPTION requests', async () => {
      requestsService.get.mockResolvedValue({
        ...prescriptionRequest,
        requestType: 'LAB',
      });
      await expect(
        service.create(dto as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects cancelled requests', async () => {
      requestsService.get.mockResolvedValue({
        ...prescriptionRequest,
        status: 'CANCELLED',
      });
      await expect(
        service.create(dto as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an out-of-range item index', async () => {
      await expect(
        service.create({ ...dto, itemIndex: 5 } as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate medication for the same prescription item', async () => {
      repo.findOne.mockResolvedValue({ id: 'med-1', status: 'PRESCRIBED' });
      await expect(
        service.create(dto as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('administer', () => {
    const prescribed = {
      id: 'med-1',
      status: 'PRESCRIBED',
      requestId: 'req-1',
      administeredAt: null,
    };

    it('records administration and completes the originating request', async () => {
      repo.qbState.getOne = { ...prescribed };
      const saved = await service.administer(
        'med-1',
        { administeredAt: '2026-01-01T10:00:00Z', notes: 'Given orally' } as never,
        tenant,
        user,
      );
      expect(saved.status).toBe('ADMINISTERED');
      expect(saved.administeredAt).toEqual(new Date('2026-01-01T10:00:00Z'));
      expect(saved.administeredById).toBe('user-1');
      expect(saved.administeredByName).toBe('dr.ade');
      expect(saved.administrationNotes).toBe('Given orally');
      expect(requestsService.transition).toHaveBeenCalledWith(
        'req-1',
        { status: 'COMPLETED', reason: 'Medication administered (mobile)' },
        tenant,
        user,
      );
    });

    it('uses the dto outcome as the resulting status', async () => {
      repo.qbState.getOne = { ...prescribed };
      const saved = await service.administer(
        'med-1',
        { outcome: 'PARTIALLY_ADMINISTERED' } as never,
        tenant,
        user,
      );
      expect(saved.status).toBe('PARTIALLY_ADMINISTERED');
    });

    it('keeps the administration recorded when the request transition fails', async () => {
      repo.qbState.getOne = { ...prescribed };
      requestsService.transition.mockRejectedValue(
        new BadRequestException('invalid transition'),
      );
      const saved = await service.administer('med-1', {} as never, tenant, user);
      expect(saved.status).toBe('ADMINISTERED');
    });

    it('rejects a second administration', async () => {
      repo.qbState.getOne = {
        ...prescribed,
        administeredAt: new Date('2026-01-01T09:00:00Z'),
      };
      await expect(
        service.administer('med-1', {} as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects administering a cancelled medication', async () => {
      repo.qbState.getOne = { ...prescribed, status: 'CANCELLED' };
      await expect(
        service.administer('med-1', {} as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update / remove / get', () => {
    it('updates only whitelisted fields', async () => {
      repo.qbState.getOne = { id: 'med-1', dose: '500', name: 'Paracetamol' };
      const saved = await service.update(
        'med-1',
        { dose: '1000', name: 'Hacked' },
        tenant,
      );
      expect(saved.dose).toBe('1000');
      expect(saved.name).toBe('Paracetamol');
    });

    it('soft-removes a medication', async () => {
      repo.qbState.getOne = { id: 'med-1' };
      await expect(service.remove('med-1', tenant)).resolves.toEqual({
        ok: true,
      });
    });

    it('throws NotFound for a missing medication', async () => {
      repo.qbState.getOne = null;
      await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
