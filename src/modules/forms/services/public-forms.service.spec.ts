import { PublicFormsService } from './public-forms.service';
import { tenant } from '../../../test-helpers/repo-mock';

describe('PublicFormsService', () => {
  let service: PublicFormsService;
  let shareLinks: {
    resolve: jest.Mock;
    tenantFor: jest.Mock;
    getForm: jest.Mock;
    latestSubmission: jest.Mock;
    verifyPatientProof: jest.Mock;
    markUsed: jest.Mock;
    setSubmission: jest.Mock;
  };
  let submissions: {
    get: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    amend: jest.Mock;
  };
  let patients: { getByPatientId: jest.Mock };
  let otp: { requestOtp: jest.Mock; verifyOtp: jest.Mock };

  const form = {
    id: 'form-1',
    code: 'INTAKE',
    name: 'Intake',
    description: null,
    eventKey: 'document_creation',
    isPublished: true,
    schemaJson: {
      fields: [{ key: 'name', label: 'Name', type: 'text' }],
    },
  };

  const link = {
    id: 'link-1',
    formDefinitionId: 'form-1',
    patientId: null,
    submissionId: null,
    mode: 'template',
    organizationId: 'org-1',
    locationId: null,
    expiresAt: new Date(Date.now() + 60_000),
    usedCount: 0,
    maxUses: null,
  };

  const saved = {
    id: 'sub-1',
    submissionNumber: 'SUB-1',
    status: 'SUBMITTED',
    patientId: null,
    dataJson: { name: 'Ada' },
  };

  beforeEach(() => {
    shareLinks = {
      resolve: jest.fn().mockResolvedValue(link),
      tenantFor: jest.fn().mockReturnValue(tenant),
      getForm: jest.fn().mockResolvedValue(form),
      latestSubmission: jest.fn().mockResolvedValue(null),
      verifyPatientProof: jest.fn().mockResolvedValue('MRN-1'),
      markUsed: jest.fn().mockResolvedValue(undefined),
      setSubmission: jest.fn().mockResolvedValue(undefined),
    };
    submissions = {
      get: jest.fn(),
      create: jest.fn().mockResolvedValue(saved),
      update: jest.fn().mockResolvedValue(saved),
      amend: jest.fn().mockResolvedValue(saved),
    };
    patients = {
      getByPatientId: jest.fn().mockResolvedValue({
        id: 'patient-1',
        patientId: 'MRN-1',
        firstName: 'Ada',
        lastName: 'Obi',
        phone: '+2348000000000',
        email: 'ada@test.dev',
      }),
    };
    otp = { requestOtp: jest.fn(), verifyOtp: jest.fn() };

    service = new PublicFormsService(
      shareLinks as never,
      submissions as never,
      patients as never,
      otp as never,
    );
  });

  it('submits a template form anonymously', async () => {
    const result = await service.submit('token', {
      dataJson: { name: 'Ada' },
    });

    expect(submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        formDefinitionId: 'form-1',
        patientId: undefined,
        status: 'SUBMITTED',
      }),
      tenant,
      expect.objectContaining({ sub: 'public' }),
    );
    expect(shareLinks.markUsed).toHaveBeenCalledWith(link);
    expect(result).toEqual({ submission: saved });
  });

  it('binds the patient from a verified proof', async () => {
    await service.submit('token', {
      dataJson: { name: 'Ada' },
      patientProof: 'proof',
    });

    expect(shareLinks.verifyPatientProof).toHaveBeenCalledWith(
      'proof',
      link,
    );
    expect(submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'MRN-1' }),
      tenant,
      expect.anything(),
    );
  });

  it('amends an already-submitted instance instead of overwriting it', async () => {
    const instanceLink = {
      ...link,
      mode: 'instance',
      patientId: 'MRN-1',
      submissionId: 'sub-old',
    };
    shareLinks.resolve.mockResolvedValue(instanceLink);
    submissions.get.mockResolvedValue({
      id: 'sub-old',
      formDefinitionId: 'form-1',
      patientId: 'MRN-1',
      status: 'SUBMITTED',
    });

    await service.submit('token', { dataJson: { name: 'Ada' } });

    expect(submissions.amend).toHaveBeenCalledWith(
      'sub-old',
      { dataJson: { name: 'Ada' } },
      tenant,
      expect.objectContaining({ sub: 'public' }),
    );
  });

  it('returns the current submission values for an instance link', async () => {
    shareLinks.resolve.mockResolvedValue({
      ...link,
      mode: 'instance',
      patientId: 'MRN-1',
      submissionId: 'sub-1',
    });
    submissions.get.mockResolvedValue({
      id: 'sub-1',
      submissionNumber: 'SUB-1',
      status: 'SUBMITTED',
      formVersion: 1,
      dataJson: { name: 'Ada' },
      amendedFromId: null,
    });

    const result = await service.get('token');

    expect(result.submission).toMatchObject({
      id: 'sub-1',
      dataJson: { name: 'Ada' },
    });
    expect(result.patient?.patientId).toBe('MRN-1');
  });

  it('uses the public OTP service with the link scope', async () => {
    otp.requestOtp.mockResolvedValue({ challengeId: 'c-1' });

    await service.requestOtp('token', { phone: '+2348000000000' });

    expect(otp.requestOtp).toHaveBeenCalledWith(
      { phone: '+2348000000000' },
      tenant,
      null,
      link,
    );
  });
});
