import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogOrmEntity } from './entities/audit-log.orm-entity';
import { AuditLogService } from './services/audit-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogOrmEntity])],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
