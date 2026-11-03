import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PatientInsightsService } from './services/patient-insights.service';
import { InsightsQueryDto } from './dto/insights-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../common/tenant-context';

@ApiTags('patient-insights')
@Controller('patients/:patientRef/insights')
export class PatientInsightsController {
  constructor(private readonly service: PatientInsightsService) {}

  @Get('biodata')
  @ApiOperation({ summary: 'Patient biodata, age, gender and marital status' })
  biodata(
    @Param('patientRef') patientRef: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.biodata(patientRef, tenantFromUser(user));
  }

  @Get('current-diagnosis')
  @ApiOperation({ summary: 'Most recent diagnosis for the patient' })
  currentDiagnosis(
    @Param('patientRef') patientRef: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.currentDiagnosis(patientRef, tenantFromUser(user));
  }

  @Get('diagnosis-history')
  @ApiOperation({
    summary: 'Diagnosis history from notes, admissions and requests',
  })
  diagnosisHistory(
    @Param('patientRef') patientRef: string,
    @Query() query: InsightsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.diagnosisHistory(
      patientRef,
      tenantFromUser(user),
      query.limit,
    );
  }

  @Get('current-vitals')
  @ApiOperation({ summary: 'Latest submitted vitals for the patient' })
  currentVitals(
    @Param('patientRef') patientRef: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.currentVitals(patientRef, tenantFromUser(user));
  }

  @Get('current-medications')
  @ApiOperation({ summary: 'Current non-cancelled medications' })
  currentMedications(
    @Param('patientRef') patientRef: string,
    @Query() query: InsightsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.currentMedications(
      patientRef,
      tenantFromUser(user),
      query.limit,
    );
  }

  @Get('current-prescriptions')
  @ApiOperation({ summary: 'Active prescription requests with items' })
  currentPrescriptions(
    @Param('patientRef') patientRef: string,
    @Query() query: InsightsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.currentPrescriptions(
      patientRef,
      tenantFromUser(user),
      query.limit,
    );
  }

  @Get('current-laboratory-requests')
  @ApiOperation({ summary: 'Active laboratory requests with items' })
  currentLaboratoryRequests(
    @Param('patientRef') patientRef: string,
    @Query() query: InsightsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.currentLaboratoryRequests(
      patientRef,
      tenantFromUser(user),
      query.limit,
    );
  }
}
