import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdmissionsService } from './admissions.service';
import {
  repoMock,
  listQuery,
  tenant,
  user,
} from '../../../test-helpers/repo-mock';

describe('AdmissionsService', () => {
  let service: AdmissionsService;
  let repo: ReturnType<typeof repoMock>;
  let wards: { get: jest.Mock };
  let beds: {
    assertBedAvailable: jest.Mock;
    setStatus: jest.Mock;
  };
  let visits: {
    get: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    end: jest.Mock;
  };

  const admission = {
    id: 'adm-1',
    admissionNumber: 'ADM-1',
    patientId: 'patient-1',
    patientName: 'Ada Obi',
    wardId: 'ward-1',
    bedId: 'bed-1',
    admissionDatetime: new Date('2026-01-05T09:00:00Z'),
    admissionType: 'ELECTIVE',
    status: 'ADMITTED',
  };

  const visit = {
    id: 'visit-1',
    visitNumber: 'VIS-1',
    patientId: 'patient-1',
    patientName: 'Ada Obi',
    visitType: 'OUTPATIENT',
    status: 'ONGOING',
    providerId: 'staff-1',
    providerName: 'Dr. Ada',
  };

  beforeEach(() => {
    repo = repoMock();
    wards = { get: jest.fn().mockResolvedValue({ id: 'ward-1' }) };
    beds = {
      assertBedAvailable: jest.fn().mockResolvedValue({
        id: 'bed-1',
        wardId: 'ward-1',
        code: 'B-1',
        status: 'AVAILABLE',
      }),
      setStatus: jest.fn().mockResolvedValue({}),
    };
    visits = {
      get: jest.fn().mockResolvedValue({ ...visit }),
      create: jest
        .fn()
        .mockResolvedValue({ ...visit, id: 'visit-2', visitType: 'INPATIENT' }),
      update: jest.fn().mockImplementation(async (_id, dto) => ({
        ...visit,
        ...dto,
      })),
      end: jest.fn().mockResolvedValue({ ...visit, status: 'COMPLETED' }),
    };
    service = new AdmissionsService(
      repo as never,
      wards as never,
      beds as never,
      visits as never,
    );
  });

  describe('list', () => {
    it('returns paginated data', async () => {
      repo.qbState.list = [admission];
      repo.qbState.total = 1;
      await expect(service.list(listQuery(), tenant)).resolves.toEqual({
        data: [admission],
        total: 1,
      });
    });

    it('filters by status and ward', async () => {
      repo.qbState.list = [];
      repo.qbState.total = 0;
      await service.list(
        listQuery({ status: 'ADMITTED', wardId: 'ward-1' }),
        tenant,
      );
      const qb = repo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith('admission.status = :status', {
        status: 'ADMITTED',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('admission.ward_id = :wardId', {
        wardId: 'ward-1',
      });
    });
  });

  describe('admit', () => {
    it('creates an ADMITTED admission and occupies the bed', async () => {
      const saved = await service.admit(
        {
          patientId: 'MRN-100',
          patientName: 'Ada Obi',
          wardId: 'ward-1',
          bedId: 'bed-1',
          admissionType: 'ELECTIVE',
        } as never,
        tenant,
        user,
      );
      expect(saved.admissionNumber).toMatch(/^ADM-/);
      expect(saved.status).toBe('ADMITTED');
      expect(saved.wardId).toBe('ward-1');
      expect(wards.get).toHaveBeenCalledWith('ward-1', tenant);
      expect(beds.assertBedAvailable).toHaveBeenCalledWith('bed-1', tenant);
      expect(beds.setStatus).toHaveBeenCalledWith('bed-1', 'OCCUPIED', tenant);
    });

    it('auto-creates a linked INPATIENT visit for a direct admit', async () => {
      const saved = await service.admit(
        {
          patientId: 'MRN-100',
          patientName: 'Ada Obi',
          admissionType: 'URGENT',
        } as never,
        tenant,
        user,
      );
      expect(visits.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'MRN-100',
          visitType: 'INPATIENT',
        }),
        tenant,
        user,
      );
      expect(saved.visitId).toBe('visit-2');
    });

    it('links a supplied visit and rejects an already-admitted one', async () => {
      const saved = await service.admit(
        { patientId: 'MRN-100', patientName: 'Ada Obi', visitId: 'visit-1' } as never,
        tenant,
        user,
      );
      expect(saved.visitId).toBe('visit-1');
      expect(visits.create).not.toHaveBeenCalled();

      repo.qbState.getOne = { ...admission, visitId: 'visit-1' };
      await expect(
        service.admit(
          { patientId: 'MRN-100', patientName: 'Ada Obi', visitId: 'visit-1' } as never,
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a bed that belongs to another ward', async () => {
      beds.assertBedAvailable.mockResolvedValue({
        id: 'bed-9',
        wardId: 'ward-9',
        status: 'AVAILABLE',
      });
      await expect(
        service.admit(
          {
            patientId: 'MRN-100',
            patientName: 'Ada Obi',
            wardId: 'ward-1',
            bedId: 'bed-9',
          },
          tenant,
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('discharge', () => {
    it('discharges an active admission and frees the bed', async () => {
      repo.qbState.getOne = { ...admission, bedId: 'bed-1' };
      const saved = await service.discharge(
        'adm-1',
        {
          dischargeType: 'DISCHARGED_HOME',
          dischargeSummary: 'Recovered',
        } as never,
        tenant,
      );
      expect(saved.status).toBe('DISCHARGED');
      expect(saved.dischargeSummary).toBe('Recovered');
      expect(beds.setStatus).toHaveBeenCalledWith('bed-1', 'AVAILABLE', tenant);
    });

    it('rejects discharging a discharged admission', async () => {
      repo.qbState.getOne = { ...admission, status: 'DISCHARGED' };
      await expect(
        service.discharge('adm-1', {}, tenant),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound for a missing admission', async () => {
      repo.qbState.getOne = null;
      await expect(
        service.discharge('missing', {}, tenant),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ends the linked visit on discharge', async () => {
      repo.qbState.getOne = { ...admission, bedId: 'bed-1', visitId: 'visit-1' };
      await service.discharge('adm-1', {} as never, tenant);
      expect(visits.end).toHaveBeenCalledWith('visit-1', {}, tenant);
    });
  });

  describe('admitFromVisit', () => {
    it('converts an ongoing visit into an INPATIENT admission', async () => {
      const result = await service.admitFromVisit(
        'visit-1',
        { wardId: 'ward-1', bedId: 'bed-1', admissionType: 'URGENT' } as never,
        tenant,
        user,
      );
      expect(result.admission.patientId).toBe('patient-1');
      expect(result.admission.visitId).toBe('visit-1');
      expect(result.admission.referringProviderName).toBe('Dr. Ada');
      expect(result.visit.visitType).toBe('INPATIENT');
      expect(beds.setStatus).toHaveBeenCalledWith('bed-1', 'OCCUPIED', tenant);
      expect(visits.update).toHaveBeenCalledWith(
        'visit-1',
        { visitType: 'INPATIENT' },
        tenant,
      );
    });

    it('rejects non-ongoing visits', async () => {
      visits.get.mockResolvedValue({ ...visit, status: 'COMPLETED' });
      await expect(
        service.admitFromVisit('visit-1', {} as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a visit that already has an active admission', async () => {
      repo.qbState.getOne = { ...admission, visitId: 'visit-1' };
      await expect(
        service.admitFromVisit('visit-1', {} as never, tenant, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('transfer', () => {
    it('frees the old bed, occupies the new one, and marks TRANSFERRED', async () => {
      repo.qbState.getOne = { ...admission, bedId: 'bed-1', wardId: 'ward-1' };
      beds.assertBedAvailable.mockResolvedValue({
        id: 'bed-2',
        wardId: 'ward-2',
        code: 'B-2',
        status: 'AVAILABLE',
      });
      const saved = await service.transfer(
        'adm-1',
        { wardId: 'ward-2', bedId: 'bed-2' },
        tenant,
      );
      expect(saved.status).toBe('TRANSFERRED');
      expect(saved.bedId).toBe('bed-2');
      expect(beds.setStatus).toHaveBeenCalledWith('bed-1', 'AVAILABLE', tenant);
      expect(beds.setStatus).toHaveBeenCalledWith('bed-2', 'OCCUPIED', tenant);
    });
  });
});
