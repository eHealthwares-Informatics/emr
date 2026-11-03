import { Module } from '@nestjs/common';
import { PatientsModule } from '../patients/patients.module';
import { FormsModule } from '../forms/forms.module';
import { AdmissionsModule } from '../admissions/admissions.module';
import { RequestsModule } from '../requests/requests.module';
import { MedicationsModule } from '../medications/medications.module';
import { PatientInsightsController } from './patient-insights.controller';
import { PatientInsightsService } from './services/patient-insights.service';

@Module({
  imports: [
    PatientsModule,
    FormsModule,
    AdmissionsModule,
    RequestsModule,
    MedicationsModule,
  ],
  controllers: [PatientInsightsController],
  providers: [PatientInsightsService],
})
export class PatientInsightsModule {}
