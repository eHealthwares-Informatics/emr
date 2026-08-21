import { Module } from '@nestjs/common';
import { IdentityProxyModule } from '../identity-proxy/identity-proxy.module';
import { LocationProxyController } from './location-proxy.controller';

@Module({
  imports: [IdentityProxyModule],
  controllers: [LocationProxyController],
})
export class LocationProxyModule {}
