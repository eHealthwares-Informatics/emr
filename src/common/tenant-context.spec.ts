import { normalizeTenantId, tenantFromUser } from './tenant-context';

describe('normalizeTenantId', () => {
  it('treats an empty string as no tenant', () => {
    // Identity issues "" (not null) for users without an organisation. Passing
    // that to a `uuid` column fails with SQLSTATE 22P02.
    expect(normalizeTenantId('')).toBeNull();
  });

  it('treats whitespace as no tenant', () => {
    expect(normalizeTenantId('   ')).toBeNull();
  });

  it('treats null and undefined as no tenant', () => {
    expect(normalizeTenantId(null)).toBeNull();
    expect(normalizeTenantId(undefined)).toBeNull();
  });

  it('keeps a real id', () => {
    expect(normalizeTenantId('60203e1c1ec8a00015baa357')).toBe(
      '60203e1c1ec8a00015baa357',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeTenantId('  abc-123  ')).toBe('abc-123');
  });
});

describe('tenantFromUser', () => {
  const base = {
    sub: '1601624e-93e5-43a0-b122-247a5dcf2c62',
    username: 'super_admin',
    roles: ['super_admin'],
    permissions: [],
  };

  it('maps a blank organisationId to null and marks the user as a global admin', () => {
    const tenant = tenantFromUser({
      ...base,
      organizationId: '',
      locationId: null,
    } as any);

    expect(tenant.organizationId).toBeNull();
    expect(tenant.locationId).toBeNull();
    expect(tenant.isGlobalAdmin).toBe(true);
  });

  it('keeps a real tenant and location', () => {
    const tenant = tenantFromUser({
      ...base,
      organizationId: '60203e1c1ec8a00015baa357',
      locationId: 'loc-1',
    } as any);

    expect(tenant.organizationId).toBe('60203e1c1ec8a00015baa357');
    expect(tenant.locationId).toBe('loc-1');
    expect(tenant.isGlobalAdmin).toBe(false);
  });

  it('normalises a blank locationId too', () => {
    const tenant = tenantFromUser({
      ...base,
      organizationId: '60203e1c1ec8a00015baa357',
      locationId: '   ',
    } as any);

    expect(tenant.locationId).toBeNull();
  });
});
