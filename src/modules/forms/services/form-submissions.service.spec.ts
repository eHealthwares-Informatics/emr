import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormSubmissionsService } from './form-submissions.service';
import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';

const schema = {
  fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
};

describe('FormSubmissionsService', () => {
  let service: FormSubmissionsService;
  let repo: ReturnType<typeof repoMock>;
  let formDefs: { get: jest.Mock };

  const form = {
    id: 'form-1',
    code: 'CLINICAL_NOTE',
    name: 'Clinical Note',
    version: 3,
    schemaJson: schema,
    isPublished: true,
    organizationId: 'org-1',
  };

  const submission = {
    id: 'sub-1',
    submissionNumber: 'SUB-1',
    formDefinitionId: 'form-1',
    formName: 'Clinical Note',
    formVersion: 3,
    patientId: 'patient-1',
    dataJson: { name: 'Ada' },
    status: 'SUBMITTED',
    submittedAt: new Date(),
    submittedById: 'user-1',
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    formDefs = { get: jest.fn() };
    service = new FormSubmissionsService(repo as never, formDefs as never);
  });

  describe('list', () => {
    it('returns paginated data', async () => {
      repo.qbState.list = [{ ...submission }];
      repo.qbState.total = 1;
      const page = await service.list(listQuery(), tenant);
      expect(page.total).toBe(1);
      expect(page.data[0].submissionNumber).toBe('SUB-1');
    });

    it('flags submissions filled against an older schema version', async () => {
      repo.qbState.list = [
        { ...submission, formVersion: 2 },
        { ...submission, id: 'sub-2', formVersion: 3 },
      ];
      repo.qbState.total = 2;
      formDefs.get.mockResolvedValue({ ...form, publishedVersion: 3 });
      const page = await service.list(listQuery(), tenant);
      expect(page.data[0].schemaOutdated).toBe(true);
      expect(page.data[0].schemaCurrentVersion).toBe(3);
      expect(page.data[1].schemaOutdated).toBe(false);
    });

    it('does not flag when the definition has no published version', async () => {
      repo.qbState.list = [{ ...submission, formVersion: 2 }];
      repo.qbState.total = 1;
      formDefs.get.mockResolvedValue({ ...form, publishedVersion: null });
      const page = await service.list(listQuery(), tenant);
      expect(page.data[0].schemaOutdated).toBe(false);
      expect(page.data[0].schemaCurrentVersion).toBeNull();
    });

    it('filters by patient, encounter and status', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({
          patientId: 'patient-1',
          encounterId: 'enc-1',
          status: 'SUBMITTED',
        }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        'submission.patient_id = :patientId',
        {
          patientId: 'patient-1',
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'submission.encounter_id = :encounterId',
        { encounterId: 'enc-1' },
      );
    });
  });

  describe('create', () => {
    it('creates a submission stamped with the form name/version', async () => {
      formDefs.get.mockResolvedValue(form);
      const saved = await service.create(
        {
          formDefinitionId: 'form-1',
          patientId: 'patient-1',
          dataJson: { name: 'Ada' },
        },
        tenant,
        user,
      );
      expect(saved.submissionNumber).toMatch(/^SUB-/);
      expect(saved.formName).toBe('Clinical Note');
      expect(saved.formVersion).toBe(3);
      expect(saved.status).toBe('SUBMITTED');
      expect(saved.submittedByName).toBe('dr.ade');
    });

    it('rejects submitting against an unpublished form', async () => {
      formDefs.get.mockResolvedValue({ ...form, isPublished: false });
      await expect(
        service.create(
          { formDefinitionId: 'form-1', patientId: 'patient-1' } as never,
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('validates data against the schema on submit', async () => {
      formDefs.get.mockResolvedValue(form);
      await expect(
        service.create(
          {
            formDefinitionId: 'form-1',
            patientId: 'patient-1',
            dataJson: {},
            status: 'SUBMITTED',
          } as never,
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('blocks changing a submitted form to a non-amend status', async () => {
      repo.qbState.getOne = { ...submission };
      await expect(
        service.update('sub-1', { status: 'DRAFT' } as never, tenant),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('submits a draft with a submittedAt stamp', async () => {
      repo.qbState.getOne = {
        ...submission,
        status: 'DRAFT',
        submittedAt: null,
      };
      formDefs.get.mockResolvedValue(form);
      const saved = await service.update(
        'sub-1',
        { status: 'SUBMITTED', dataJson: { name: 'Ada' } } as never,
        tenant,
      );
      expect(saved.status).toBe('SUBMITTED');
      expect(saved.submittedAt).toBeInstanceOf(Date);
    });
  });

  describe('amend', () => {
    it('creates a new submission linked via amendedFromId', async () => {
      repo.qbState.getOne = submission;
      formDefs.get.mockResolvedValue(form);
      const amended = await service.amend(
        'sub-1',
        { dataJson: { name: 'Ada Obi' } },
        tenant,
        user,
      );
      expect(amended.amendedFromId).toBe('sub-1');
      expect(amended.formDefinitionId).toBe('form-1');
      expect(amended.patientId).toBe('patient-1');
      expect(amended.status).toBe('SUBMITTED');
      // Amendments are fresh fills against the currently published schema.
      expect(amended.formVersion).toBe(form.version);
    });

    it('stamps an amendment with the current published version, not the original fill version', async () => {
      repo.qbState.getOne = { ...submission, formVersion: 2 };
      formDefs.get.mockResolvedValue({ ...form, version: 4, publishedVersion: 3 });
      const amended = await service.amend(
        'sub-1',
        { dataJson: { name: 'Ada Obi' } },
        tenant,
        user,
      );
      expect(amended.formVersion).toBe(3);
    });

    it('rejects an amendment with invalid data', async () => {
      repo.qbState.getOne = submission;
      formDefs.get.mockResolvedValue(form);
      await expect(
        service.amend('sub-1', { dataJson: {} }, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getChain', () => {
    it('walks ancestors and descendants oldest-first', async () => {
      const original = {
        ...submission,
        id: 'sub-orig',
        submissionNumber: 'SUB-0',
        amendedFromId: null,
      };
      const amend1 = { ...submission, id: 'sub-1', amendedFromId: 'sub-orig' };
      const amend2 = { ...submission, id: 'sub-2', amendedFromId: 'sub-1' };

      // findOneScoped for the start id, then the ancestor hop
      const getOneMock = jest
        .fn()
        .mockResolvedValueOnce(amend2) // start
        .mockResolvedValueOnce(amend1) // ancestor walk
        .mockResolvedValueOnce(original); // ancestor walk ends

      // Children of the root: amend1, amend2; then each has no children.
      const getManyMock = jest
        .fn()
        .mockResolvedValueOnce([amend1, amend2])
        .mockResolvedValue([]);
      const qb = {
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        orderBy: jest.fn(() => qb),
        getOne: getOneMock,
        getMany: getManyMock,
        getManyAndCount: jest.fn(() => Promise.resolve([[], 0])),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getChain('sub-2', tenant);
      expect(result.data.map((s) => s.id)).toEqual([
        'sub-orig',
        'sub-1',
        'sub-2',
      ]);
    });
  });

  it('throws NotFound for a missing submission', async () => {
    repo.qbState.getOne = null;
    await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
