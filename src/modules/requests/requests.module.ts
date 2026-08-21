import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../common/audit/audit.module';
import { RequestOrmEntity } from './entities/request.orm-entity';
import { RequestItemOrmEntity } from './entities/request-item.orm-entity';
import { RequestStatusHistoryOrmEntity } from './entities/request-status-history.orm-entity';
import { RequestsService } from './services/requests.service';
import { LisIntegrationService } from './services/lis-integration.service';
import { PharmacyIntegrationService } from './services/pharmacy-integration.service';
import { RequestsController } from './controllers/requests.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RequestOrmEntity,
      RequestItemOrmEntity,
      RequestStatusHistoryOrmEntity,
    ]),
    HttpModule,
    AuditModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService, LisIntegrationService, PharmacyIntegrationService],
  exports: [RequestsService],
})
export class RequestsModule {}
