import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IdentityProxyService } from './identity-proxy.service';

@Module({
  imports: [HttpModule],
  providers: [IdentityProxyService],
  exports: [IdentityProxyService],
})
export class IdentityProxyModule {}
