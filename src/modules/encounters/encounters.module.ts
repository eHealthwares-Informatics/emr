import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncounterOrmEntity } from './entities/encounter.orm-entity';
import { EncountersService } from './services/encounters.service';
import { EncountersController } from './controllers/encounters.controller';
import { VisitsModule } from '../visits/visits.module';
import { RequestsModule } from '../requests/requests.module';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EncounterOrmEntity]),
    VisitsModule,
    RequestsModule,
    PatientsModule,
  ],
  controllers: [EncountersController],
  providers: [EncountersService],
  exports: [EncountersService],
})
export class EncountersModule {}