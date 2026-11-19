import { BadRequestException } from '@nestjs/common';
import { FeatureSessionsService } from './feature-sessions.service';
import { tenant, user } from '../../../test-helpers/repo-mock';

describe('FeatureSessionsService', () => {
  let service: FeatureSessionsService;
  let features: { get: jest.Mock };
  let patients: { getByPatientId: jest.Mock };
  let admissions: { getCurrentForPatient: jest.Mock };
  let visits: {
    get: jest.Mock;
    findOpenForPatientOnDate: jest.Mock;
    findSameDayAppointment: jest.Mock;
    create: jest.Mock;
    ensureSameDayAppointment: jest.Mock;
    linkAppointment: jest.Mock;
  };
  let encounters: { create: jest.Mock };

  const feature = {
    id: 'feature-1',
    isActive: true,
    encounterType: 'ANTENATAL',
    formDefinitionId: 'form-1',
    form: { id: 'form-1', name: 'Antenatal Encounter' },
    subModule: { id: 'sub-1', name: 'Maternity' },
  };

  const visit = {
    id: 'visit-1',
    visitNumber: 'VIS-1',
    patientId: 'MRN-1',
    patientName: 'Ada Obi',
    status: 'ONGOING',
    startDatetime: new Date(),
  };

  const encounter = {
    id: 'enc-1',
    encounterNumber: 'ENC-1',
    patientId: 'MRN-1',
    visitId: 'visit-1',
    encounterType: 'ANTENATAL',
  };

  beforeEach(() => {
    features = { get: jest.fn().mockResolvedValue(feature) };
    patients = {
      getByPatientId: jest.fn().mockResolvedValue({
        patientId: 'MRN-1',
        firstName: 'Ada',
        lastName: 'Obi',
      }),
    };
    admissions = { getCurrentForPatient: jest.fn().mockResolvedValue(null) };
    visits = {
      get: jest.fn(),
      findOpenForPatientOnDate: jest.fn().mockResolvedValue(null),
      findSameDayAppointment: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(visit),
      ensureSameDayAppointment: jest
        .fn()
        .mockResolvedValue({ id: 'appt-1', appointmentNumber: 'APT-1' }),
      linkAppointment: jest.fn().mockResolvedValue(undefined),
    };
    encounters = { create: jest.fn().mockResolvedValue(encounter) };

    service = new FeatureSessionsService(
      features as never,
      patients as never,
      admissions as never,
      visits as never,
      encounters as never,
    );
  });

  it('creates a visit and encounter when none exist, then ensures an appointment', async () => {
    const result = await service.start('feature-1', 'MRN-1', tenant, user);

    expect(visits.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'MRN-1',
        patientName: 'Ada Obi',
        visitType: 'OUTPATIENT',
      }),
      tenant,
      user,
    );
    expect(visits.ensureSameDayAppointment).toHaveBeenCalledWith(
      visit,
      tenant,
      user,
      expect.any(Date),
    );
    expect(visits.linkAppointment).toHaveBeenCalledWith(visit, {
      id: 'appt-1',
      appointmentNumber: 'APT-1',
    });
    expect(encounters.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'MRN-1',
        visitId: 'visit-1',
        encounterType: 'ANTENATAL',
        reason: 'Antenatal Encounter',
      }),
      tenant,
      user,
    );
    expect(result).toEqual({
      encounter,
      visit,
      appointment: { id: 'appt-1', appointmentNumber: 'APT-1' },
      admission: null,
    });
  });

  it('reuses the visit linked to a current admission', async () => {
    admissions.getCurrentForPatient.mockResolvedValue({
      id: 'adm-1',
      visitId: 'visit-1',
    });
    visits.get.mockResolvedValue(visit);

    const result = await service.start('feature-1', 'MRN-1', tenant, user);

    expect(visits.create).not.toHaveBeenCalled();
    expect(visits.findOpenForPatientOnDate).not.toHaveBeenCalled();
    expect(result.admission).toMatchObject({ id: 'adm-1' });
  });

  it('reuses an ongoing same-day visit', async () => {
    visits.findOpenForPatientOnDate.mockResolvedValue(visit);

    await service.start('feature-1', 'MRN-1', tenant, user);

    expect(visits.create).not.toHaveBeenCalled();
    expect(visits.ensureSameDayAppointment).toHaveBeenCalledWith(
      visit,
      tenant,
      user,
      expect.any(Date),
    );
  });

  it('rejects an inactive feature', async () => {
    features.get.mockResolvedValue({ ...feature, isActive: false });

    await expect(
      service.start('feature-1', 'MRN-1', tenant, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
