import { FormAccessService } from './form-access.service';
import { repoMock, tenant, user } from '../../../test-helpers/repo-mock';

const published = [
  { id: 'f1', code: 'CLINICAL_NOTE', name: 'Clinical Note', isPublished: true },
  { id: 'f2', code: 'LAB_REQUEST', name: 'Lab Request', isPublished: true },
  { id: 'f3', code: 'CONSENT', name: 'Consent', isPublished: true },
];

describe('FormAccessService', () => {
  let service: FormAccessService;
  let accessRepo: ReturnType<typeof repoMock>;
  let formDefs: { list: jest.Mock };

  beforeEach(() => {
    accessRepo = repoMock();
    formDefs = {
      list: jest.fn().mockResolvedValue({ data: published, total: published.length }),
    };
    service = new FormAccessService(accessRepo as never, formDefs as never);
  });

  it('returns all published forms for super admins without consulting access rows', async () => {
    const result = await service.getAvailableForms(
      { ...user, roles: ['super_admin'] },
      tenant,
    );
    expect(result.data).toHaveLength(3);
    expect(accessRepo.find).not.toHaveBeenCalled();
  });

  it('defaults to all published forms when no access rows exist', async () => {
    accessRepo.find.mockResolvedValue([]);
    const result = await service.getAvailableForms(user, tenant);
    expect(result.data).toHaveLength(3);
  });

  it('grants only explicitly allowed forms', async () => {
    accessRepo.find.mockResolvedValue([
      { userId: 'user-1', roleCode: null, formCode: 'CLINICAL_NOTE', isAllowed: true },
      { userId: 'user-1', roleCode: null, formCode: 'LAB_REQUEST', isAllowed: true },
    ]);
    const result = await service.getAvailableForms(user, tenant);
    expect(result.data.map((f) => f.code)).toEqual(['CLINICAL_NOTE', 'LAB_REQUEST']);
  });

  it('grants everything when a wildcard allow row exists, then applies denies', async () => {
    accessRepo.find.mockResolvedValue([
      { userId: 'user-1', roleCode: null, formCode: null, isAllowed: true },
      { userId: 'user-1', roleCode: null, formCode: 'CONSENT', isAllowed: false },
    ]);
    const result = await service.getAvailableForms(user, tenant);
    expect(result.data.map((f) => f.code)).toEqual(['CLINICAL_NOTE', 'LAB_REQUEST']);
  });

  it('resolves role-based rows via role codes', async () => {
    accessRepo.find.mockResolvedValue([
      { userId: null, roleCode: 'doctor', formCode: 'CLINICAL_NOTE', isAllowed: true },
    ]);
    const result = await service.getAvailableForms(
      { ...user, roles: ['doctor'] },
      tenant,
    );
    expect(result.data.map((f) => f.code)).toEqual(['CLINICAL_NOTE']);
    // the find query must include role codes
    expect(accessRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          expect.objectContaining({ roleCode: expect.anything() }),
        ]),
      }),
    );
  });
});
