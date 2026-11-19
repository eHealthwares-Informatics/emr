import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IdentityProxyService } from '../modules/identity-proxy/identity-proxy.service';
import { normalizeTenantId } from './tenant-context';

/**
 * Guards body-supplied `locationId` values. A location must belong to the
 * caller's organisation (identity is the source of truth for locations).
 * Super admins (no organisation) may target any location.
 */
@Injectable()
export class TenantLocationService {
  private readonly logger = new Logger(TenantLocationService.name);

  constructor(private readonly identity: IdentityProxyService) {}

  async assertBelongsToOrganization(
    locationId: string | null | undefined,
    organizationId: string | null | undefined,
  ): Promise<void> {
    const location = normalizeTenantId(locationId);
    if (!location) return;

    const org = normalizeTenantId(organizationId);
    if (!org) return;

    try {
      const found = await this.identity.getLocationById(location, org);
      if (found && found.organizationId === org) return;
    } catch (error) {
      this.logger.warn(
        `Location validation failed: location=${location} org=${org} reason=${String(
          (error as Error)?.message,
        )}`,
      );
    }

    throw new BadRequestException(
      'Location does not belong to the organisation',
    );
  }
}
