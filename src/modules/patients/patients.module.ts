import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../common/audit/audit.module';
import { TagsModule } from '../tags/tags.module';
import { PatientOrmEntity } from './entities/patient.orm-entity';
import { PatientsService } from './services/patients.service';
import { PatientsController } from './controllers/patients.controller';
import { PatientIdentityService } from './services/patient-identity.service';

@Module({
  imports: [TypeOrmModule.forFeature([PatientOrmEntity]), AuditModule, TagsModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientIdentityService],
  exports: [PatientsService, PatientIdentityService],
})
export class PatientsModule {}
