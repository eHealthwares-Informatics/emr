import { RequestUser } from './decorators/current-user.decorator';

export interface TenantContext {
  organizationId: string | null;
  locationId: string | null;
  isGlobalAdmin: boolean;
}

export function tenantFromUser(user: RequestUser): TenantContext {
  return {
    organizationId: user.organizationId ?? null,
    locationId: user.locationId ?? null,
    isGlobalAdmin: !user.organizationId,
  };
}
