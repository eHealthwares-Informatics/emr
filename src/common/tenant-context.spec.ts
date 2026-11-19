import { normalizeTenantId, resolveTenantClaims, tenantFromUser } from './tenant-context';

describe('tenant-context', () => {
  describe('normalizeTenantId', () => {
    it('treats blank and whitespace as no tenant', () => {
      expect(normalizeTenantId('')).toBeNull();
      expect(normalizeTenantId('   ')).toBeNull();
      expect(normalizeTenantId(null)).toBeNull();
      expect(normalizeTenantId(undefined)).toBeNull();
    });

    it('keeps real ids', () => {
      expect(normalizeTenantId(' org-1 ')).toBe('org-1');
    });
  });

  describe('tenantFromUser', () => {
    it('treats a super admin with a blank org as global-scoped', () => {
      const tenant = tenantFromUser({
        sub: 'u1',
        organizationId: '',
        locationId: null,
        roles: ['super_admin'],
      } as any);

      expect(tenant).toMatchObject({
        organizationId: null,
        locationId: null,
        isSuperAdmin: true,
        isGlobalAdmin: true,
        organizationScope: 'all',
        userId: 'u1',
      });
    });

    it('treats a normal user with a blank org as denied (not global)', () => {
      const tenant = tenantFromUser({
        sub: 'u2',
        organizationId: '',
        locationId: null,
        roles: ['doctor'],
      } as any);

      expect(tenant.isSuperAdmin).toBe(false);
      expect(tenant.isGlobalAdmin).toBe(false);
      expect(tenant.organizationScope).toBe('org');
    });

    it('keeps a concrete org for a normal user', () => {
      const tenant = tenantFromUser({
        sub: 'u3',
        organizationId: 'org-a',
        locationId: 'loc-a',
        roles: ['doctor'],
      } as any);

      expect(tenant).toMatchObject({
        organizationId: 'org-a',
        locationId: 'loc-a',
        isSuperAdmin: false,
        organizationScope: 'org',
      });
    });
  });

  describe('resolveTenantClaims', () => {
    it('uses the header organisation for a super admin', () => {
      const user = resolveTenantClaims(
        { sub: 'u1', organizationId: '', locationId: null, roles: ['super_admin'] },
        { 'x-organization-id': 'org-b' },
      );

      expect(user.organizationId).toBe('org-b');
      expect(user.organizationScope).toBe('org');
    });

    it('maps the global marker to a global scope', () => {
      const user = resolveTenantClaims(
        { sub: 'u1', organizationId: 'org-a', roles: ['super_admin'] },
        { 'x-organization-id': 'global' },
      );

      expect(user.organizationId).toBeNull();
      expect(user.organizationScope).toBe('global');
    });

    it('ignores header overrides for non super admins', () => {
      const user = resolveTenantClaims(
        { sub: 'u2', organizationId: 'org-a', locationId: 'loc-a', roles: ['doctor'] },
        { 'x-organization-id': 'org-b', 'x-location-id': 'loc-b' },
      );

      expect(user.organizationId).toBe('org-a');
      expect(user.locationId).toBe('loc-a');
    });
  });
});
