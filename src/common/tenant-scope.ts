import { ForbiddenException } from '@nestjs/common';
import { normalizeTenantId, TenantContext } from './tenant-context';

export type TenantScopeMode = 'shared-read' | 'strict';

type TenantRow = {
  organizationId?: string | null;
  organization_id?: string | null;
};

interface QueryBuilderLike {
  andWhere(sql: string, params?: Record<string, unknown>): unknown;
}

/**
 * Canonical tenant predicate:
 * - super admin (`all`)    → no filter
 * - super admin (`global`) → `organization_id IS NULL`
 * - org user (`shared-read`) → own org OR shared/null rows
 * - org user (`strict`)    → own org only
 */
export function applyTenantScope(
  qb: QueryBuilderLike,
  alias: string,
  tenant?: TenantContext | null,
  options?: { mode?: TenantScopeMode },
): void {
  if (!tenant) return;

  if (tenant.isSuperAdmin && tenant.organizationScope === 'all') {
    return;
  }

  if (tenant.organizationScope === 'global') {
    qb.andWhere(`${alias}.organization_id IS NULL`);
  } else if (tenant.isSuperAdmin && !tenant.organizationId) {
    return;
  } else if ((options?.mode ?? 'shared-read') === 'shared-read') {
    qb.andWhere(
      `(${alias}.organization_id = :tenantOrganizationId OR ${alias}.organization_id IS NULL)`,
      { tenantOrganizationId: tenant.organizationId },
    );
  } else if (tenant.organizationId) {
    qb.andWhere(`${alias}.organization_id = :tenantOrganizationId`, {
      tenantOrganizationId: tenant.organizationId,
    });
  } else {
    qb.andWhere(`${alias}.organization_id IS NULL AND 1 = 0`);
  }

  if (tenant.locationId) {
    qb.andWhere(
      `(${alias}.location_id = :tenantLocationId OR ${alias}.location_id IS NULL)`,
      { tenantLocationId: tenant.locationId },
    );
  }
}

export function isSharedRow(row: TenantRow | null | undefined): boolean {
  if (!row) return true;
  return !normalizeTenantId(row.organizationId ?? row.organization_id ?? null);
}

/** Shared/global records are read-only for normal users. */
export function assertCanWriteRow(
  row: TenantRow | null | undefined,
  tenant?: TenantContext | null,
): void {
  if (tenant?.isSuperAdmin) return;
  if (isSharedRow(row)) {
    throw new ForbiddenException('Shared/global records are read-only');
  }
}

/** Only a super admin may pass an explicit organisation/location. */
export function assertTenantOverride(
  tenant: TenantContext | null | undefined,
  requestedOrganizationId?: unknown,
  requestedLocationId?: unknown,
): void {
  if (tenant?.isSuperAdmin) return;
  if (
    normalizeTenantId(requestedOrganizationId) ||
    normalizeTenantId(requestedLocationId)
  ) {
    throw new ForbiddenException(
      'Only super administrators may specify an organisation or location',
    );
  }
}

export function resolveOrganizationForWrite(
  tenant: TenantContext | null | undefined,
  requestedOrganizationId?: unknown,
): string | null {
  assertTenantOverride(tenant, requestedOrganizationId);
  if (!tenant) return normalizeTenantId(requestedOrganizationId);
  if (tenant.isSuperAdmin) {
    const explicit = normalizeTenantId(requestedOrganizationId);
    if (explicit) return explicit;
    return tenant.organizationScope === 'global' ? null : tenant.organizationId;
  }
  return tenant.organizationId;
}

export function resolveLocationForWrite(
  tenant: TenantContext | null | undefined,
  requestedLocationId?: unknown,
): string | null {
  assertTenantOverride(tenant, undefined, requestedLocationId);
  if (tenant?.isSuperAdmin) {
    const explicit = normalizeTenantId(requestedLocationId);
    if (explicit) return explicit;
  }
  return tenant?.locationId ?? null;
}
