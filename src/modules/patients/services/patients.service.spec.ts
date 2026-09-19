import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';

describe('PatientsService', () => {
  let service: PatientsService;
  let repo: ReturnType<typeof repoMock>;
  let audit: { record: jest.Mock };

  const patient = {
    id: 'patient-1',
    patientId: 'MRN-100',
    firstName: 'Ada',
    lastName: 'Obi',
    gender: 'FEMALE',
    phone: '0801111111',
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    audit = { record: jest.fn().mockResolvedValue({}) };
    service = new PatientsService(repo as never, audit as never);
  });

  describe('list', () => {
    it('returns paginated data', async () => {
      repo.qbState.list = [patient];
      repo.qbState.total = 1;

      const result = await service.list(listQuery(), tenant);
      expect(result).toEqual({ data: [patient], total: 1 });
      // tenant scoping applied
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('patient');
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        expect.anything(),
      );
    });

    it('applies gender filter', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(listQuery({ filter: 'gender|MALE' }), tenant);
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith('patient.gender = :gender', {
        gender: 'MALE',
      });
    });
  });

  describe('get / getByPatientId', () => {
    it('returns a scoped patient by id', async () => {
      repo.qbState.getOne = patient;
      await expect(service.get('patient-1', tenant)).resolves.toEqual(patient);
    });

    it('throws NotFound when the id does not resolve', async () => {
      repo.qbState.getOne = null;
      await expect(service.get('missing', tenant)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('looks up by MRN for the by-mrn flow', async () => {
      repo.qbState.getOne = patient;
      await expect(service.getByPatientId('MRN-100', tenant)).resolves.toEqual(
        patient,
      );
    });

    it('throws NotFound for an unknown MRN', async () => {
      repo.qbState.getOne = null;
      await expect(
        service.getByPatientId('MRN-999', tenant),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('auto-generates an MRN when none is supplied', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.qbState.getOne = null;
      const dto = { firstName: 'Ada', lastName: 'Obi' };

      const saved = await service.create(dto, tenant, user);
      expect(saved.patientId).toMatch(/^MRN-/);
      expect(saved.organizationId).toBe('org-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'patient.created' }),
      );
    });

    it('rejects a duplicate MRN', async () => {
      repo.findOne.mockResolvedValue(patient);
      await expect(
        service.create({ patientId: 'MRN-100' } as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('applies changes and audits a field-level diff', async () => {
      repo.qbState.getOne = { ...patient };
      const saved = await service.update(
        'patient-1',
        { phone: '0802222222' },
        tenant,
        user,
      );
      expect(saved.phone).toBe('0802222222');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'patient.updated',
          metadata: expect.objectContaining({
            changedFields: {
              phone: { from: '0801111111', to: '0802222222' },
            },
          }),
        }),
      );
    });

    it('throws NotFound for a missing patient', async () => {
      repo.qbState.getOne = null;
      await expect(
        service.update('missing', {}, tenant, user),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-removes the patient', async () => {
      repo.qbState.getOne = patient;
      await expect(service.remove('patient-1', tenant)).resolves.toEqual({
        ok: true,
      });
      expect(repo.softRemove).toHaveBeenCalledWith(patient);
    });
  });
});
