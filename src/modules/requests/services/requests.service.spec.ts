import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestsService } from './requests.service';
import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';

describe('RequestsService', () => {
  let service: RequestsService;
  let repo: ReturnType<typeof repoMock>;
  let itemRepo: ReturnType<typeof repoMock>;
  let historyRepo: ReturnType<typeof repoMock>;
  let lis: { createLabOrder: jest.Mock; cancelLabOrder: jest.Mock };
  let pharmacy: { createPrescriptionOrder: jest.Mock };
  let audit: { record: jest.Mock };

  const request = {
    id: 'req-1',
    requestNumber: 'REQ-1',
    requestType: 'RADIOLOGY',
    status: 'REQUESTED',
    syncStatus: 'NONE',
    priority: 'ROUTINE',
    patientId: 'patient-1',
    patientName: 'Ada Obi',
    requestedAt: new Date(),
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    itemRepo = repoMock();
    historyRepo = repoMock();
    lis = { createLabOrder: jest.fn(), cancelLabOrder: jest.fn() };
    pharmacy = { createPrescriptionOrder: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue({}) };
    service = new RequestsService(
      repo as never,
      itemRepo as never,
      historyRepo as never,
      lis as never,
      pharmacy as never,
      audit as never,
    );
  });

  describe('list', () => {
    it('returns paginated data', async () => {
      repo.qbState.list = [request];
      repo.qbState.total = 1;
      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [request],
        total: 1,
      });
    });

    it('filters by status, type, patient and provider', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({
          status: 'IN_PROGRESS',
          requestType: 'LAB',
          patientId: 'patient-1',
          providerId: 'staff-1',
        }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith('request.status = :status', {
        status: 'IN_PROGRESS',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('request.request_type = :requestType', {
        requestType: 'LAB',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'request.ordering_provider_id = :providerId',
        { providerId: 'staff-1' },
      );
    });
  });

  describe('get / getHistory', () => {
    it('assembles items and status history', async () => {
      repo.qbState.getOne = request;
      itemRepo.find.mockResolvedValue([{ id: 'item-1', requestId: 'req-1' }]);
      historyRepo.find.mockResolvedValue([
        { id: 'h1', requestId: 'req-1', toStatus: 'REQUESTED' },
      ]);
      const result = await service.get('req-1', tenant);
      expect(result.id).toBe('req-1');
      expect(result.items).toEqual([{ id: 'item-1', requestId: 'req-1' }]);
      expect(result.statusHistory).toHaveLength(1);
    });

    it('exposes a lightweight history payload', async () => {
      repo.qbState.getOne = request;
      historyRepo.find.mockResolvedValue([{ id: 'h1' }]);
      await expect(service.getHistory('req-1', tenant)).resolves.toEqual({
        data: [{ id: 'h1' }],
      });
    });
  });

  describe('create', () => {
    beforeEach(() => {
      // create() finishes with this.get(), which reads the last saved entity
      // from the query-builder mock and item/history rows from find().
      repo.save.mockImplementation(async (entity: unknown) => {
        repo.qbState.getOne = entity;
        return entity;
      });
      itemRepo.find.mockResolvedValue([]);
      historyRepo.find.mockResolvedValue([]);
    });

    it('creates a request with items, an initial history entry and audit', async () => {
      const dto = {
        requestType: 'RADIOLOGY',
        patientId: 'patient-1',
        patientName: 'Ada Obi',
        items: [{ name: 'Chest X-ray' }],
      };
      const saved = await service.create(dto as never, tenant, user);
      expect(saved.requestNumber).toMatch(/^REQ-/);
      expect(saved.status).toBe('REQUESTED');
      expect(saved.syncStatus).toBe('NONE');
      const createdEntity = repo.save.mock.calls[0][0] as Record<string, unknown>;
      expect(createdEntity.items).toEqual([
        expect.objectContaining({ name: 'Chest X-ray' }),
      ]);
      expect(historyRepo.save).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'request.created' }),
      );
      expect(itemRepo.find).toHaveBeenCalled();
    });

    it('syncs LAB requests to the LIS and records the external order id', async () => {
      lis.createLabOrder.mockResolvedValue({
        externalOrderId: 'lab-9',
        externalReference: 'REF-9',
      });
      const saved = await service.create(
        { requestType: 'LAB', patientId: 'patient-1', items: [{ name: 'CBC' }] } as never,
        tenant,
        user,
      );
      expect(saved.syncStatus).toBe('SYNCED');
      expect(saved.externalOrderId).toBe('lab-9');
      expect(lis.createLabOrder).toHaveBeenCalled();
    });

    it('marks sync as FAILED when the external service errors', async () => {
      lis.createLabOrder.mockRejectedValue(new Error('LIS down'));
      const saved = await service.create(
        { requestType: 'LAB', patientId: 'patient-1' } as never,
        tenant,
        user,
      );
      expect(saved.syncStatus).toBe('FAILED');
      expect(saved.syncError).toBe('LIS down');
    });
  });

  describe('update', () => {
    it('replaces items and applies edits to open requests', async () => {
      repo.qbState.getOne = { ...request };
      const saved = await service.update(
        'req-1',
        { priority: 'URGENT', items: [{ name: 'MRI' }] } as never,
        tenant,
      );
      expect(saved.priority).toBe('URGENT');
      expect(itemRepo.delete).toHaveBeenCalledWith({ requestId: 'req-1' });
      expect(saved.items).toEqual([expect.objectContaining({ name: 'MRI' })]);
    });

    it('blocks editing closed requests', async () => {
      repo.qbState.getOne = { ...request, status: 'COMPLETED' };
      await expect(
        service.update('req-1', { priority: 'URGENT' } as never, tenant),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('transition', () => {
    it('moves REQUESTED -> IN_PROGRESS with history and audit', async () => {
      repo.qbState.getOne = { ...request };
      const saved = await service.transition(
        'req-1',
        { status: 'IN_PROGRESS' } as never,
        tenant,
        user,
      );
      expect(saved.status).toBe('IN_PROGRESS');
      expect(historyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          fromStatus: 'REQUESTED',
          toStatus: 'IN_PROGRESS',
          actorUserId: 'user-1',
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'request.status_transition' }),
      );
    });

    it('stamps completedAt on COMPLETED', async () => {
      repo.qbState.getOne = { ...request, status: 'IN_PROGRESS' };
      const saved = await service.transition(
        'req-1',
        { status: 'COMPLETED' } as never,
        tenant,
        user,
      );
      expect(saved.completedAt).toBeInstanceOf(Date);
    });

    it('rejects an illegal transition', async () => {
      repo.qbState.getOne = { ...request, status: 'COMPLETED' };
      await expect(
        service.transition('req-1', { status: 'IN_PROGRESS' } as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('attempts an external LIS cancel when cancelling a synced lab request', async () => {
      repo.qbState.getOne = {
        ...request,
        requestType: 'LAB',
        externalOrderId: 'lab-9',
      };
      lis.cancelLabOrder.mockResolvedValue(undefined);
      const saved = await service.transition(
        'req-1',
        { status: 'CANCELLED', reason: 'Duplicate order' } as never,
        tenant,
        user,
      );
      expect(saved.status).toBe('CANCELLED');
      expect(lis.cancelLabOrder).toHaveBeenCalledWith('lab-9', undefined);
    });

    it('keeps the local cancel when the external cancel fails', async () => {
      repo.qbState.getOne = {
        ...request,
        requestType: 'LAB',
        externalOrderId: 'lab-9',
      };
      lis.cancelLabOrder.mockRejectedValue(new Error('LIS down'));
      const saved = await service.transition(
        'req-1',
        { status: 'CANCELLED' } as never,
        tenant,
        user,
      );
      expect(saved.status).toBe('CANCELLED');
    });
  });

  describe('addNote', () => {
    it('appends a note entry with audit', async () => {
      repo.qbState.getOne = request;
      historyRepo.save.mockResolvedValue({ id: 'note-1', reason: 'Awaiting results' });
      const entry = await service.addNote('req-1', 'Awaiting results', tenant, user);
      expect(entry.reason).toBe('Awaiting results');
      expect(historyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ toStatus: null, fromStatus: null }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'request.note_added' }),
      );
    });

    it('rejects an empty note', async () => {
      repo.qbState.getOne = request;
      await expect(
        service.addNote('req-1', '   ', tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('sync', () => {
    it('updates external identifiers and re-runs the sync (re-sync button)', async () => {
      repo.qbState.getOne = { ...request, requestType: 'LAB' };
      repo.save.mockImplementation(async (entity: unknown) => {
        repo.qbState.getOne = entity;
        return entity;
      });
      itemRepo.find.mockResolvedValue([]);
      historyRepo.find.mockResolvedValue([]);
      lis.createLabOrder.mockResolvedValue({
        externalOrderId: 'lab-2',
        externalReference: 'REF-2',
      });
      const saved = await service.sync(
        'req-1',
        { externalOrderId: 'lab-2', externalReference: 'REF-2' } as never,
        tenant,
        'token',
      );
      expect(saved.externalOrderId).toBe('lab-2');
      expect(saved.externalReference).toBe('REF-2');
      expect(saved.syncStatus).toBe('SYNCED');
      expect(lis.createLabOrder).toHaveBeenCalledWith(expect.anything(), 'token');
    });
  });

  it('throws NotFound for a missing request', async () => {
    repo.qbState.getOne = null;
    await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
