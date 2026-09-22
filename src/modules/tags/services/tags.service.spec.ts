import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TagsService } from './tags.service';
import {
  repoMock,
  listQuery,
  tenant,
} from '../../../test-helpers/repo-mock';

describe('TagsService', () => {
  let service: TagsService;
  let repo: ReturnType<typeof repoMock>;
  let patientTagsRepo: ReturnType<typeof repoMock>;

  const tag = {
    id: 'tag-1',
    name: 'VIP',
    color: '#e64980',
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    patientTagsRepo = repoMock();
    service = new TagsService(repo as never, patientTagsRepo as never);
  });

  describe('list', () => {
    it('returns paginated data scoped by tenant', async () => {
      repo.qbState.list = [tag];
      repo.qbState.total = 1;
      const result = await service.list(listQuery(), tenant);
      expect(result).toEqual({ data: [tag], total: 1 });
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('tag');
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        expect.anything(),
      );
    });
  });

  describe('create', () => {
    it('creates a tag with tenant scoping', async () => {
      const saved = await service.create({ name: 'VIP', color: '#e64980' }, tenant);
      expect(saved.name).toBe('VIP');
      expect(saved.color).toBe('#e64980');
      expect(saved.organizationId).toBe('org-1');
    });

    it('rejects duplicate names within the organization', async () => {
      repo.qbState.getOne = tag;
      await expect(
        service.create({ name: 'VIP' } as never, tenant),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('soft-deletes the tag and clears join rows', async () => {
      repo.qbState.getOne = { ...tag };
      const result = await service.remove('tag-1', tenant);
      expect(result).toEqual({ ok: true });
      expect(repo.softRemove).toHaveBeenCalled();
      expect(patientTagsRepo.delete).toHaveBeenCalledWith({ tagId: 'tag-1' });
    });

    it('throws NotFound for a missing tag', async () => {
      repo.qbState.getOne = null;
      await expect(service.remove('missing', tenant)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('tagsForPatients', () => {
    it('groups tag rows by patient id', async () => {
      const qbMock = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { patientId: 'patient-1', id: 'tag-1', name: 'VIP', color: '#e64980' },
          { patientId: 'patient-1', id: 'tag-2', name: 'Diabetic', color: null },
          { patientId: 'patient-2', id: 'tag-1', name: 'VIP', color: '#e64980' },
        ]),
      };
      patientTagsRepo.createQueryBuilder = jest.fn(() => qbMock);

      const result = await service.tagsForPatients(['patient-1', 'patient-2']);
      expect(result.get('patient-1')).toHaveLength(2);
      expect(result.get('patient-2')).toEqual([
        { id: 'tag-1', name: 'VIP', color: '#e64980' },
      ]);
      expect(result.get('patient-3')).toBeUndefined();
    });

    it('skips the query when there are no patients', async () => {
      const result = await service.tagsForPatients([]);
      expect(result.size).toBe(0);
      expect(patientTagsRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('assignToPatient', () => {
    it('replaces the patient tag set', async () => {
      repo.qbState.list = [tag, { ...tag, id: 'tag-2', name: 'Diabetic', color: null }];
      const result = await service.assignToPatient(
        'patient-1',
        { tagIds: ['tag-1', 'tag-2'] },
        tenant,
      );
      expect(patientTagsRepo.delete).toHaveBeenCalledWith({ patientId: 'patient-1' });
      expect(patientTagsRepo.save).toHaveBeenCalled();
      expect(result.patientId).toBe('patient-1');
    });

    it('rejects unknown tag ids', async () => {
      repo.qbState.list = [];
      await expect(
        service.assignToPatient('patient-1', { tagIds: ['tag-404'] }, tenant),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
