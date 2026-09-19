import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdmissionOrmEntity } from './entities/admission.orm-entity';
import { AdmissionsService } from './services/admissions.service';
import { AdmissionsController } from './controllers/admissions.controller';
import { WardsModule } from '../wards/wards.module';
import { BedsModule } from '../beds/beds.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdmissionOrmEntity]),
    WardsModule,
    BedsModule,
  ],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
