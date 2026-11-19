import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdmissionsModule } from '../admissions/admissions.module';
import { EncountersModule } from '../encounters/encounters.module';
import { FormDefinitionOrmEntity } from '../forms/entities/form-definition.orm-entity';
import { IdentityProxyModule } from '../identity-proxy/identity-proxy.module';
import { PatientsModule } from '../patients/patients.module';
import { VisitsModule } from '../visits/visits.module';
import { FeaturesController } from './controllers/features.controller';
import { SubModulesController } from './controllers/sub-modules.controller';
import { FeatureOrmEntity } from './entities/feature.orm-entity';
import { SubModuleOrmEntity } from './entities/sub-module.orm-entity';
import { FeatureSessionsService } from './services/feature-sessions.service';
import { FeaturesService } from './services/features.service';
import { SubModulesService } from './services/sub-modules.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubModuleOrmEntity,
      FeatureOrmEntity,
      FormDefinitionOrmEntity,
    ]),
    IdentityProxyModule,
    PatientsModule,
    VisitsModule,
    AdmissionsModule,
    EncountersModule,
  ],
  controllers: [SubModulesController, FeaturesController],
  providers: [SubModulesService, FeaturesService, FeatureSessionsService],
  exports: [SubModulesService, FeaturesService],
})
export class SubModulesModule {}
