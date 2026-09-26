import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentOrmEntity } from '../appointments/entities/appointment.orm-entity';
import { VisitOrmEntity } from '../visits/entities/visit.orm-entity';
import { PatientOrmEntity } from '../patients/entities/patient.orm-entity';
import { RequestOrmEntity } from '../requests/entities/request.orm-entity';
import { EncounterOrmEntity } from '../encounters/entities/encounter.orm-entity';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppointmentOrmEntity,
      VisitOrmEntity,
      PatientOrmEntity,
      RequestOrmEntity,
      EncounterOrmEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
