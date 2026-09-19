import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormDefinitionsService } from './form-definitions.service';
import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';

const validSchema = { fields: [{ key: 'name', label: 'Name', type: 'text' }] };

describe('FormDefinitionsService', () => {
  let service: FormDefinitionsService;
  let repo: ReturnType<typeof repoMock>;

  const form = {
    id: 'form-1',
    code: 'CLINICAL_NOTE',
    name: 'Clinical Note',
    category: 'CLINICAL',
    version: 1,
    schemaJson: validSchema,
    isPublished: false,
    publishedVersion: null,
    isActive: true,
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    service = new FormDefinitionsService(repo as never);
  });

  describe('list / get / getByCode', () => {
    it('returns paginated data', async () => {
      repo.qbState.list = [form];
      repo.qbState.total = 1;
      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [form],
        total: 1,
      });
    });

    it('filters by category and published flag', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({ category: 'CLINICAL', published: 'true' }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith('form.category = :category', {
        category: 'CLINICAL',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'form.is_published = :published',
        {
          published: true,
        },
      );
    });

    it('gets a form by code (available-forms flow)', async () => {
      repo.qbState.getOne = form;
      await expect(service.getByCode('CLINICAL_NOTE', tenant)).resolves.toEqual(
        form,
      );
    });

    it('throws NotFound for an unknown code', async () => {
      repo.qbState.getOne = null;
      await expect(service.getByCode('NOPE', tenant)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates an unpublished form with schema validation', async () => {
      repo.findOne.mockResolvedValue(null);
      const saved = await service.create(
        {
          code: 'CLINICAL_NOTE',
          name: 'Clinical Note',
          category: 'CLINICAL',
          schemaJson: validSchema,
        } as never,
        tenant,
        user,
      );
      expect(saved.isPublished).toBe(false);
      expect(saved.version).toBe(1);
      expect(saved.organizationId).toBe('org-1');
    });

    it('rejects a duplicate code', async () => {
      repo.findOne.mockResolvedValue(form);
      await expect(
        service.create({ code: 'CLINICAL_NOTE' } as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid schema', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          {
            code: 'BAD',
            name: 'Bad',
            category: 'CLINICAL',
            schemaJson: { fields: [{ key: 'x', label: 'X', type: 'bogus' }] },
          } as never,
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('bumps the version when the schema changes', async () => {
      repo.qbState.getOne = { ...form };
      const saved = await service.update(
        'form-1',
        { schemaJson: validSchema } as never,
        tenant,
      );
      expect(saved.version).toBe(2);
    });

    it('rejects an invalid schema on update', async () => {
      repo.qbState.getOne = { ...form };
      await expect(
        service.update(
          'form-1',
          {
            schemaJson: { fields: [{ key: 'x', label: 'X', type: 'bogus' }] },
          } as never,
          tenant,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('publish / unpublish / remove', () => {
    it('publishes the current version', async () => {
      repo.qbState.getOne = { ...form, version: 3 };
      const saved = await service.publish('form-1', tenant);
      expect(saved.isPublished).toBe(true);
      expect(saved.publishedVersion).toBe(3);
    });

    it('refuses to publish an empty form', async () => {
      repo.qbState.getOne = { ...form, schemaJson: { fields: [] } };
      await expect(service.publish('form-1', tenant)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('unpublishes and clears publishedVersion', async () => {
      repo.qbState.getOne = { ...form, isPublished: true, publishedVersion: 2 };
      const saved = await service.unpublish('form-1', tenant);
      expect(saved.isPublished).toBe(false);
      expect(saved.publishedVersion).toBeNull();
    });

    it('blocks deleting a published form', async () => {
      repo.qbState.getOne = { ...form, isPublished: true };
      await expect(service.remove('form-1', tenant)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('soft-removes an unpublished form', async () => {
      repo.qbState.getOne = form;
      await expect(service.remove('form-1', tenant)).resolves.toEqual({
        ok: true,
      });
      expect(repo.softRemove).toHaveBeenCalledWith(form);
    });
  });
});
