import { Global, Module } from '@nestjs/common';
import { IdentityProxyModule } from '../modules/identity-proxy/identity-proxy.module';
import { TenantLocationService } from './tenant-location.service';

/**
 * Global so any feature service can validate body-supplied `locationId`
 * without re-importing the identity proxy.
 */
@Global()
@Module({
  imports: [IdentityProxyModule],
  providers: [TenantLocationService],
  exports: [TenantLocationService],
})
export class TenantLocationModule {}
