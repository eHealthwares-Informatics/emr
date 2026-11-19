import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { repoMock, listQuery, tenant, user } from '../../../test-helpers/repo-mock';

describe('FeaturesService', () => {
  let service: FeaturesService;
  let repo: ReturnType<typeof repoMock>;
  let subModuleRepo: ReturnType<typeof repoMock>;
  let formRepo: ReturnType<typeof repoMock>;

  const feature = {
    id: 'feature-1',
    subModuleId: 'sub-1',
    formDefinitionId: 'form-1',
    encounterType: 'ANTENATAL',
    roleCodes: ['emr_clinician'],
    sortOrder: 10,
    isActive: true,
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    subModuleRepo = repoMock();
    formRepo = repoMock();
    service = new FeaturesService(
      repo as never,
      subModuleRepo as never,
      formRepo as never,
    );
  });

  describe('list / get', () => {
    it('returns paginated features', async () => {
      repo.qbState.list = [feature];
      repo.qbState.total = 1;

      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [feature],
        total: 1,
      });
    });

    it('rejects a missing feature', async () => {
      repo.qbState.getOne = null;
      await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a feature with its form, roles and encounter type', async () => {
      subModuleRepo.qbState.getOne = { id: 'sub-1' };
      formRepo.qbState.getOne = { id: 'form-1' };
      repo.qbState.getOne = null;

      const saved = await service.create(
        {
          subModuleId: 'sub-1',
          formDefinitionId: 'form-1',
          encounterType: 'ANTENATAL',
          roleCodes: ['emr_clinician'],
          sortOrder: 10,
        },
        tenant,
        user,
      );

      expect(saved).toMatchObject({
        subModuleId: 'sub-1',
        formDefinitionId: 'form-1',
        encounterType: 'ANTENATAL',
        roleCodes: ['emr_clinician'],
        organizationId: 'org-1',
      });
    });

    it('rejects a form already featured in the same submodule', async () => {
      subModuleRepo.qbState.getOne = { id: 'sub-1' };
      formRepo.qbState.getOne = { id: 'form-1' };
      repo.qbState.getOne = { id: 'existing' };

      await expect(
        service.create(
          { subModuleId: 'sub-1', formDefinitionId: 'form-1' },
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown form definition', async () => {
      subModuleRepo.qbState.getOne = { id: 'sub-1' };
      formRepo.qbState.getOne = null;

      await expect(
        service.create(
          { subModuleId: 'sub-1', formDefinitionId: 'missing' },
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
