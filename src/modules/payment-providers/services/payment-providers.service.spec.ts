import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentProvidersService } from './payment-providers.service';
import { repoMock, listQuery, tenant } from '../../../test-helpers/repo-mock';

describe('PaymentProvidersService', () => {
  let service: PaymentProvidersService;
  let repo: ReturnType<typeof repoMock>;

  const provider = {
    id: 'provider-1',
    code: 'HMO',
    name: 'Hygeia HMO',
    type: 'HMO',
    isActive: true,
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    service = new PaymentProvidersService(repo as never);
  });

  describe('list', () => {
    it('returns paginated, org-scoped providers', async () => {
      repo.qbState.list = [provider];
      repo.qbState.total = 1;

      const result = await service.list(listQuery(), tenant);
      expect(result).toEqual({ data: [provider], total: 1 });
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('provider');
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        expect.anything(),
      );
    });
  });

  describe('get', () => {
    it('returns a scoped provider', async () => {
      repo.qbState.getOne = provider;
      await expect(service.get('provider-1', tenant)).resolves.toEqual(provider);
    });

    it('throws NotFound when missing', async () => {
      repo.qbState.getOne = null;
      await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('rejects a duplicate code', async () => {
      repo.findOne.mockResolvedValue(provider);
      await expect(
        service.create(
          { code: 'HMO', name: 'Hygeia HMO', type: 'HMO' },
          tenant,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('persists a new provider with org stamping', async () => {
      repo.findOne.mockResolvedValue(null);
      const saved = await service.create(
        { code: 'CASH', name: 'Cash', type: 'CASH' },
        tenant,
      );
      expect(saved.organizationId).toBe('org-1');
      expect(saved.locationId).toBe('loc-1');
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects a code that would collide with another row', async () => {
      repo.qbState.getOne = provider;
      repo.findOne.mockResolvedValue({ ...provider, id: 'provider-other' });
      await expect(
        service.update('provider-1', { code: 'OTHER' }, tenant),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('soft-removes the provider', async () => {
      repo.qbState.getOne = provider;
      await expect(service.remove('provider-1', tenant)).resolves.toEqual({
        ok: true,
      });
      expect(repo.softRemove).toHaveBeenCalled();
    });
  });
});