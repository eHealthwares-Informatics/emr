import { BadRequestException } from '@nestjs/common';
import { SubModulesService } from './sub-modules.service';
import { repoMock, listQuery, tenant, user } from '../../../test-helpers/repo-mock';

describe('SubModulesService', () => {
  let service: SubModulesService;
  let repo: ReturnType<typeof repoMock>;
  let identity: { listRoles: jest.Mock };

  const subModule = {
    id: 'sub-1',
    code: 'MATERNITY',
    name: 'Maternity',
    description: 'Maternity services',
    icon: 'Baby',
    sortOrder: 10,
    isActive: true,
    features: [
      {
        id: 'feature-1',
        formDefinitionId: 'form-1',
        encounterType: 'ANTENATAL',
        roleCodes: ['emr_clinician'],
        sortOrder: 10,
        isActive: true,
        form: {
          id: 'form-1',
          code: 'ANTENATAL_ENCOUNTER',
          name: 'Antenatal Encounter',
          description: 'Antenatal visit',
        },
      },
    ],
  };

  beforeEach(() => {
    repo = repoMock();
    identity = { listRoles: jest.fn().mockResolvedValue([]) };
    service = new SubModulesService(repo as never, identity as never);
  });

  describe('navigation', () => {
    it('maps active submodules and their forms into menu features', async () => {
      repo.qbState.list = [subModule];

      const result = await service.navigation(tenant);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'sub-1',
        name: 'Maternity',
        icon: 'Baby',
      });
      expect(result.data[0].features[0]).toMatchObject({
        id: 'feature-1',
        name: 'Antenatal Encounter',
        code: 'ANTENATAL_ENCOUNTER',
        roleCodes: ['emr_clinician'],
      });
    });

    it('drops features without a published form', async () => {
      repo.qbState.list = [
        {
          ...subModule,
          features: [{ ...subModule.features[0], form: undefined }],
        },
      ];

      const result = await service.navigation(tenant);

      expect(result.data[0].features).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('rejects a duplicate code', async () => {
      repo.qbState.getOne = { id: 'existing' };

      await expect(
        service.create(
          { code: 'MATERNITY', name: 'Maternity' },
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a submodule scoped to the tenant', async () => {
      repo.qbState.getOne = null;

      const saved = await service.create(
        { code: 'MATERNITY', name: 'Maternity', sortOrder: 5 },
        tenant,
        user,
      );

      expect(saved).toMatchObject({
        code: 'MATERNITY',
        name: 'Maternity',
        sortOrder: 5,
        organizationId: 'org-1',
      });
    });
  });

  describe('roleOptions', () => {
    it('proxies identity role options', async () => {
      identity.listRoles.mockResolvedValue([
        { code: 'emr_clinician', name: 'EMR Clinician' },
      ]);

      await expect(service.roleOptions('token')).resolves.toEqual({
        data: [{ code: 'emr_clinician', name: 'EMR Clinician' }],
      });
    });
  });
});
