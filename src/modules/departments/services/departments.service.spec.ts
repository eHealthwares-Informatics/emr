import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { repoMock, listQuery, tenant } from '../../../test-helpers/repo-mock';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let repo: ReturnType<typeof repoMock>;

  const department = {
    id: 'dept-1',
    code: 'PHARMACY',
    name: 'Pharmacy',
    departmentType: 'PHARMACY',
    description: 'Main dispensary',
    isActive: true,
    organizationId: 'org-1',
    locationId: 'loc-1',
  };

  beforeEach(() => {
    repo = repoMock();
    service = new DepartmentsService(repo as never);
  });

  describe('list', () => {
    it('returns paginated departments', async () => {
      repo.qbState.list = [department];
      repo.qbState.total = 1;
      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [department],
        total: 1,
      });
    });

    it('applies locationId, departmentType, and isActive filters', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({
          locationId: 'loc-1',
          departmentType: 'PHARMACY',
          isActive: 'true',
        }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        'department.location_id = :locationId',
        {
          locationId: 'loc-1',
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'department.department_type = :departmentType',
        {
          departmentType: 'PHARMACY',
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'department.is_active = :isActive',
        {
          isActive: true,
        },
      );
    });
  });

  describe('get / create / update / remove', () => {
    it('returns a scoped department', async () => {
      repo.qbState.getOne = department;
      await expect(service.get('dept-1', tenant)).resolves.toEqual(department);
    });

    it('throws NotFoundException for missing department', async () => {
      repo.qbState.getOne = null;
      await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('creates a department with tenant and site scoping', async () => {
      repo.qbState.getOne = null; // for code check
      const dto = {
        code: 'CARDIOLOGY',
        name: 'Cardiology',
        departmentType: 'OPD' as const,
        locationId: 'site-hq',
      };
      const saved = await service.create(dto, tenant);
      expect(saved.code).toBe('CARDIOLOGY');
      expect(saved.organizationId).toBe('org-1');
      expect(saved.locationId).toBe('site-hq');
      expect(saved.isActive).toBe(true);
    });

    it('rejects duplicate code within the organisation', async () => {
      repo.qbState.getOne = department; // existing found
      const dto = { code: 'PHARMACY', name: 'Pharmacy Duplicate' };
      await expect(service.create(dto as never, tenant)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('updates fields', async () => {
      // First call is findOneScoped, second call during code check if changed
      repo.qbState.getOne = { ...department };
      const saved = await service.update(
        'dept-1',
        { name: 'Pharmacy & Dispensary' },
        tenant,
      );
      expect(saved.name).toBe('Pharmacy & Dispensary');
    });

    it('soft-removes a department', async () => {
      repo.qbState.getOne = department;
      await expect(service.remove('dept-1', tenant)).resolves.toEqual({
        ok: true,
      });
      expect(repo.softRemove).toHaveBeenCalledWith(department);
    });
  });
});
