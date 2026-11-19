import { ForbiddenException } from '@nestjs/common';
import { TenantContext } from './tenant-context';
import {
  applyTenantScope,
  assertCanWriteRow,
  assertTenantOverride,
  isSharedRow,
  resolveLocationForWrite,
  resolveOrganizationForWrite,
} from './tenant-scope';

function tenant(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    organizationId: 'org-a',
    locationId: null,
    isGlobalAdmin: false,
    isSuperAdmin: false,
    organizationScope: 'org',
    userId: 'u1',
    ...overrides,
  };
}

function qb() {
  return { andWhere: jest.fn() } as any;
}

describe('tenant-scope', () => {
  it('adds no filter for a super admin in "all" scope', () => {
    const builder = qb();
    applyTenantScope(
      builder,
      'o',
      tenant({ isSuperAdmin: true, isGlobalAdmin: true, organizationScope: 'all', organizationId: null }),
    );
    expect(builder.andWhere).not.toHaveBeenCalled();
  });

  it('filters to null-org rows in global scope', () => {
    const builder = qb();
    applyTenantScope(
      builder,
      'o',
      tenant({ isSuperAdmin: true, organizationScope: 'global', organizationId: null }),
    );
    expect(builder.andWhere).toHaveBeenCalledWith('o.organization_id IS NULL');
  });

  it('admits own + shared rows for a normal user', () => {
    const builder = qb();
    applyTenantScope(builder, 'o', tenant());
    expect(builder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('o.organization_id = :tenantOrganizationId OR o.organization_id IS NULL'),
      { tenantOrganizationId: 'org-a' },
    );
  });

  it('blocks a normal user from mutating a shared row', () => {
    expect(() => assertCanWriteRow({ organizationId: null }, tenant())).toThrow(ForbiddenException);
  });

  it('allows a super admin to mutate a shared row', () => {
    expect(() =>
      assertCanWriteRow({ organizationId: null }, tenant({ isSuperAdmin: true })),
    ).not.toThrow();
  });

  it('rejects a normal user passing an organisation', () => {
    expect(() => assertTenantOverride(tenant(), 'org-b')).toThrow(ForbiddenException);
  });

  it('stamps a normal user write with their own org', () => {
    expect(resolveOrganizationForWrite(tenant(), undefined)).toBe('org-a');
  });

  it('honours a super admin explicit org', () => {
    expect(resolveOrganizationForWrite(tenant({ isSuperAdmin: true }), 'org-b')).toBe('org-b');
  });

  it('creates null-org rows for a super admin in global scope', () => {
    expect(
      resolveOrganizationForWrite(
        tenant({ isSuperAdmin: true, organizationScope: 'global', organizationId: null }),
      ),
    ).toBeNull();
  });

  it('uses the user location for a normal user', () => {
    expect(resolveLocationForWrite(tenant({ locationId: 'loc-a' }))).toBe('loc-a');
  });

  it('allows a super admin to override the location', () => {
    expect(resolveLocationForWrite(tenant({ isSuperAdmin: true, locationId: 'loc-a' }), 'loc-b')).toBe(
      'loc-b',
    );
  });

  it('detects shared rows', () => {
    expect(isSharedRow({ organizationId: null })).toBe(true);
    expect(isSharedRow({ organization_id: 'org-a' })).toBe(false);
  });
});
