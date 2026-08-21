import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthProxyService } from './auth-proxy.service';
import { AuthProxyController } from './auth-proxy.controller';

@Module({
  imports: [HttpModule],
  providers: [AuthProxyService],
  controllers: [AuthProxyController],
  exports: [AuthProxyService],
})
export class AuthProxyModule {}