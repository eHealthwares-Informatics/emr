import { RequestUser } from './decorators/current-user.decorator';

export interface TenantContext {
  organizationId: string | null;
  locationId: string | null;
  isGlobalAdmin: boolean;
}

/**
 * Normalise a tenant identifier that came off a JWT claim.
 *
 * Identity issues `organizationId: ""` (not `null`) for users without an
 * organisation — e.g. `super_admin`. `?? null` only catches null/undefined, so
 * the empty string used to flow straight through into `organization_id`, a
 * Postgres `uuid` column, and fail with
 *
 *   invalid input syntax for type uuid: ""   (SQLSTATE 22P02)
 *
 * Blank/whitespace values mean "no tenant", so they become null.
 */
export function normalizeTenantId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function tenantFromUser(user: RequestUser): TenantContext {
  const organizationId = normalizeTenantId(user.organizationId);
  const locationId = normalizeTenantId(user.locationId);
  return {
    organizationId,
    locationId,
    // No tenant means a global admin; keep the original semantics but base it
    // on the normalised value so "" and null behave identically.
    isGlobalAdmin: !organizationId,
  };
}
