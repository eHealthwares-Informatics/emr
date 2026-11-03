import { NotFoundException } from '@nestjs/common';
import { PatientInsightsService } from './patient-insights.service';
import { tenant } from '../../../test-helpers/repo-mock';

const patient = {
  id: 'patient-1',
  patientId: 'MRN-100',
  firstName: 'Ada',
  lastName: 'Obi',
  otherNames: null,
  dateOfBirth: '1990-01-15',
  gender: 'FEMALE',
  maritalStatus: 'MARRIED',
  bloodGroup: 'O+',
  genotype: 'AA',
  isActive: true,
};

function buildService(overrides: Record<string, unknown> = {}) {
  const patients = {
    get: jest.fn().mockRejectedValue(new NotFoundException()),
    getByPatientId: jest.fn().mockResolvedValue(patient),
  };
  const formDefinitions = {
    getByCode: jest.fn().mockRejectedValue(new NotFoundException()),
  };
  const formSubmissions = {
    list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  };
  const admissions = {
    list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  };
  const requests = {
    list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    listWithItems: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  };
  const medications = {
    list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  };

  const service = new PatientInsightsService(
    patients as never,
    formDefinitions as never,
    formSubmissions as never,
    admissions as never,
    requests as never,
    medications as never,
  );

  Object.assign(patients, overrides.patients ?? {});
  Object.assign(formDefinitions, overrides.formDefinitions ?? {});
  Object.assign(formSubmissions, overrides.formSubmissions ?? {});
  Object.assign(admissions, overrides.admissions ?? {});
  Object.assign(requests, overrides.requests ?? {});
  Object.assign(medications, overrides.medications ?? {});

  return {
    service,
    patients,
    formDefinitions,
    formSubmissions,
    admissions,
    requests,
    medications,
  };
}

describe('PatientInsightsService', () => {
  it('returns biodata with derived age', async () => {
    const { service } = buildService();
    const result = await service.biodata('MRN-100', tenant);
    expect(result.patientId).toBe('MRN-100');
    expect(result.gender).toBe('FEMALE');
    expect(result.maritalStatus).toBe('MARRIED');
    expect(result.ageYears).toBeGreaterThan(30);
    expect(result.ageMonths).toBeGreaterThan(360);
  });

  it('resolves a UUID patient ref through the id lookup', async () => {
    const { service, patients } = buildService({
      patients: { get: jest.fn().mockResolvedValue(patient) },
    });
    await service.biodata('11111111-1111-4111-8111-111111111111', tenant);
    expect(patients.get).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      tenant,
    );
  });

  it('picks the newest diagnosis across notes, admissions and requests', async () => {
    const { service } = buildService({
      formDefinitions: {
        getByCode: jest.fn().mockResolvedValue({ id: 'form-note' }),
      },
      formSubmissions: {
        list: jest.fn().mockResolvedValue({
          data: [
            {
              submissionNumber: 'SUB-1',
              dataJson: { assessment: 'Malaria' },
              submittedAt: '2026-10-01T10:00:00.000Z',
              createdAt: '2026-10-01T10:00:00.000Z',
              status: 'SUBMITTED',
              encounterId: 'enc-1',
            },
          ],
          total: 1,
        }),
      },
      admissions: {
        list: jest.fn().mockResolvedValue({
          data: [
            {
              diagnosis: 'Severe malaria',
              admissionDatetime: '2026-10-02T10:00:00.000Z',
              admissionNumber: 'ADM-1',
              status: 'ADMITTED',
            },
          ],
          total: 1,
        }),
      },
      requests: {
        list: jest.fn().mockResolvedValue({
          data: [
            {
              diagnosis: 'Suspected typhoid',
              requestType: 'LAB',
              requestedAt: '2026-10-03T10:00:00.000Z',
              requestNumber: 'REQ-1',
              encounterId: null,
              status: 'REQUESTED',
            },
          ],
          total: 1,
        }),
        listWithItems: jest.fn(),
      },
    });

    const result = await service.currentDiagnosis('MRN-100', tenant);
    expect(result.available).toBe(true);
    expect(result.diagnosis?.text).toBe('Suspected typhoid');
    expect(result.diagnosis?.source).toBe('LAB');
  });

  it('returns the latest vitals submission', async () => {
    const { service } = buildService({
      formDefinitions: {
        getByCode: jest.fn().mockResolvedValue({ id: 'form-vitals' }),
      },
      formSubmissions: {
        list: jest.fn().mockResolvedValue({
          data: [
            {
              submissionNumber: 'VIT-1',
              formName: 'Vitals',
              formVersion: 1,
              submittedAt: '2026-10-04T10:00:00.000Z',
              createdAt: '2026-10-04T10:00:00.000Z',
              submittedByName: 'Nurse Joy',
              encounterId: 'enc-1',
              visitId: 'visit-1',
              dataJson: { temperature: 37.1, heartRate: 80 },
            },
          ],
          total: 1,
        }),
      },
    });

    const result = await service.currentVitals('MRN-100', tenant);
    expect(result.available).toBe(true);
    expect(result.vitals?.data).toEqual({ temperature: 37.1, heartRate: 80 });
  });

  it('returns active prescription requests with items', async () => {
    const { service } = buildService({
      requests: {
        list: jest.fn(),
        listWithItems: jest.fn().mockResolvedValue({
          data: [
            {
              requestNumber: 'RX-1',
              requestType: 'PRESCRIPTION',
              status: 'REQUESTED',
              priority: 'ROUTINE',
              diagnosis: 'Malaria',
              clinicalNotes: null,
              requestedAt: '2026-10-05T10:00:00.000Z',
              completedAt: null,
              orderingProviderName: 'Dr Ada',
              items: [{ name: 'Artemether', dose: '80', doseUnit: 'mg' }],
            },
            {
              requestNumber: 'RX-2',
              requestType: 'PRESCRIPTION',
              status: 'CANCELLED',
              priority: 'ROUTINE',
              diagnosis: null,
              clinicalNotes: null,
              requestedAt: '2026-10-06T10:00:00.000Z',
              completedAt: null,
              orderingProviderName: null,
              items: [],
            },
          ],
          total: 2,
        }),
      },
    });

    const result = await service.currentPrescriptions('MRN-100', tenant);
    expect(result.available).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].requestNumber).toBe('RX-1');
    expect(result.items[0].items[0].name).toBe('Artemether');
  });
});
