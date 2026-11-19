import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { FormShareLinksService } from './form-share-links.service';
import { repoMock, tenant, user } from '../../../test-helpers/repo-mock';

describe('FormShareLinksService', () => {
  let service: FormShareLinksService;
  let repo: ReturnType<typeof repoMock>;
  let submissionRepo: ReturnType<typeof repoMock>;
  let formDefs: { get: jest.Mock };
  let submissions: { get: jest.Mock };
  let patients: { getByPatientId: jest.Mock };
  let jwt: { sign: jest.Mock; verify: jest.Mock };
  let config: { get: jest.Mock };

  const form = {
    id: 'form-1',
    code: 'ANTENATAL',
    name: 'Antenatal',
    eventKey: 'document_creation',
    isPublished: true,
    organizationId: 'org-1',
  };

  beforeEach(() => {
    repo = repoMock();
    submissionRepo = repoMock();
    formDefs = { get: jest.fn().mockResolvedValue(form) };
    submissions = {
      get: jest.fn().mockResolvedValue({
        id: 'sub-1',
        formDefinitionId: 'form-1',
        patientId: 'MRN-1',
      }),
    };
    patients = {
      getByPatientId: jest.fn().mockResolvedValue({
        id: 'patient-1',
        patientId: 'MRN-1',
        firstName: 'Ada',
        lastName: 'Obi',
      }),
    };
    jwt = {
      sign: jest.fn().mockReturnValue('proof-token'),
      verify: jest.fn(),
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'PUBLIC_WEB_URL') return 'https://app.test';
        if (key === 'FORM_PROOF_SECRET') return 'proof-secret';
        return fallback;
      }),
    };

    service = new FormShareLinksService(
      repo as never,
      submissionRepo as never,
      formDefs as never,
      submissions as never,
      patients as never,
      jwt as never,
      config as never,
    );
  });

  it('creates a template link with a public URL', async () => {
    const result = await service.create('form-1', {}, tenant, user);

    expect(result.mode).toBe('template');
    expect(result.token).toBeTruthy();
    expect(result.url).toContain('https://app.test/f/');
    expect(patients.getByPatientId).not.toHaveBeenCalled();
  });

  it('creates an instance link from a submission and verifies the patient', async () => {
    const result = await service.create(
      'form-1',
      { submissionId: 'sub-1' },
      tenant,
      user,
    );

    expect(result.mode).toBe('instance');
    expect(result.patientId).toBe('MRN-1');
    expect(result.submissionId).toBe('sub-1');
    expect(patients.getByPatientId).toHaveBeenCalledWith('MRN-1', tenant);
  });

  it('rejects expired links', async () => {
    repo.findOne.mockResolvedValue({
      id: 'link-1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      maxUses: null,
      usedCount: 0,
    });

    await expect(service.resolve('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects links without a matching hash', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.resolve('token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('signs and verifies a patient proof bound to the link', () => {
    const link = {
      id: 'link-1',
    } as never;

    const proof = service.signPatientProof(link, 'MRN-1');
    expect(proof).toBe('proof-token');

    jwt.verify.mockReturnValue({
      typ: 'form-patient',
      linkId: 'link-1',
      patientId: 'MRN-1',
    });
    expect(service.verifyPatientProof('proof-token', link)).toBe('MRN-1');
  });

  it('rejects a proof from a different link', () => {
    jwt.verify.mockReturnValue({
      typ: 'form-patient',
      linkId: 'other-link',
      patientId: 'MRN-1',
    });

    expect(() =>
      service.verifyPatientProof('proof-token', { id: 'link-1' } as never),
    ).toThrow(UnauthorizedException);
  });
});
