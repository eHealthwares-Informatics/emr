import { NotFoundException } from '@nestjs/common';
import { StaffService } from './staff.service';
import { repoMock, listQuery, tenant } from '../../../test-helpers/repo-mock';

describe('StaffService', () => {
  let service: StaffService;
  let repo: ReturnType<typeof repoMock>;

  const staff = {
    id: 'staff-1',
    staffNumber: 'STF-1',
    firstName: 'Ada',
    lastName: 'Obi',
    roleType: 'Doctor',
    department: 'Cardiology',
    isActive: true,
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    service = new StaffService(repo as never);
  });

  describe('list', () => {
    it('returns paginated data', async () => {
      repo.qbState.list = [staff];
      repo.qbState.total = 1;
      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [staff],
        total: 1,
      });
    });

    it('applies role/category/department/active filters', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({
          roleType: 'Doctor',
          category: 'Medical',
          department: 'Card',
          isActive: 'true',
        }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith('staff.role_type = :roleType', {
        roleType: 'Doctor',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('staff.category = :category', {
        category: 'Medical',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('staff.is_active = :isActive', {
        isActive: true,
      });
    });
  });

  describe('get / create / update / remove', () => {
    it('returns a scoped staff member', async () => {
      repo.qbState.getOne = staff;
      await expect(service.get('staff-1', tenant)).resolves.toEqual(staff);
    });

    it('throws NotFound for a missing member', async () => {
      repo.qbState.getOne = null;
      await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('auto-generates staffNumber and defaults isActive when creating', async () => {
      const dto = { firstName: 'Ada', lastName: 'Obi', roleType: 'Doctor' };
      const saved = await service.create(dto as never, tenant);
      expect(saved.staffNumber).toMatch(/^STF-/);
      expect(saved.isActive).toBe(true);
      expect(saved.organizationId).toBe('org-1');
    });

    it('preserves a supplied staffNumber', async () => {
      const saved = await service.create(
        { firstName: 'Ada', staffNumber: 'STF-100' } as never,
        tenant,
      );
      expect(saved.staffNumber).toBe('STF-100');
    });

    it('updates fields', async () => {
      repo.qbState.getOne = { ...staff };
      const saved = await service.update(
        'staff-1',
        { department: 'Neurology' } as never,
        tenant,
      );
      expect(saved.department).toBe('Neurology');
    });

    it('soft-removes a staff member', async () => {
      repo.qbState.getOne = staff;
      await expect(service.remove('staff-1', tenant)).resolves.toEqual({
        ok: true,
      });
      expect(repo.softRemove).toHaveBeenCalledWith(staff);
    });
  });
});
