import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../common/audit/audit.module';
import { PatientOrmEntity } from './entities/patient.orm-entity';
import { PatientsService } from './services/patients.service';
import { PatientsController } from './controllers/patients.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PatientOrmEntity]), AuditModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
