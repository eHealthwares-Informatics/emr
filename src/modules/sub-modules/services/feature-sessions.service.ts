import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { AdmissionsService } from '../../admissions/services/admissions.service';
import { EncountersService } from '../../encounters/services/encounters.service';
import { PatientsService } from '../../patients/services/patients.service';
import { VisitsService } from '../../visits/services/visits.service';
import type { VisitOrmEntity } from '../../visits/entities/visit.orm-entity';
import { FeaturesService } from './features.service';

/**
 * Starts a feature session for a patient.
 *
 * Guarantees the patient has, for the current day:
 *  - an appointment (reused or auto-created by VisitsService),
 *  - a visit (the visit linked to an active admission, or an ongoing visit,
 *    or a newly created outpatient visit),
 *  - an encounter linked to that visit, typed from the feature configuration.
 *
 * All lookups are same-day/scoped so repeated form opens reuse the existing
 * visit instead of creating duplicates.
 */
@Injectable()
export class FeatureSessionsService {
  constructor(
    private readonly featuresService: FeaturesService,
    private readonly patientsService: PatientsService,
    private readonly admissionsService: AdmissionsService,
    private readonly visitsService: VisitsService,
    private readonly encountersService: EncountersService,
  ) {}

  async start(
    featureId: string,
    patientId: string,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const feature = await this.featuresService.get(featureId, tenant);
    if (!feature.isActive) {
      throw new BadRequestException('Feature is not active');
    }
    if (!feature.form) {
      throw new BadRequestException('Feature has no form definition');
    }

    const patient = await this.patientsService.getByPatientId(
      patientId,
      tenant,
    );
    const patientName =
      [patient.firstName, patient.lastName].filter(Boolean).join(' ') ||
      patient.patientId;

    const admission = await this.admissionsService.getCurrentForPatient(
      patientId,
      tenant,
    );

    let visit: VisitOrmEntity | null = null;
    if (admission?.visitId) {
      visit = await this.visitsService
        .get(admission.visitId, tenant)
        .catch(() => null);
    }
    if (!visit) {
      visit = await this.visitsService.findOpenForPatientOnDate(
        patientId,
        new Date(),
        tenant,
      );
    }

    if (!visit) {
      const appointment = await this.visitsService.findSameDayAppointment(
        patientId,
        new Date(),
        tenant,
      );
      visit = await this.visitsService.create(
        {
          patientId,
          patientName,
          visitType: 'OUTPATIENT',
          appointmentId: appointment?.id,
        },
        tenant,
        user,
      );
    }

    // `visitsService.create` already ensures an appointment; for a reused
    // visit this makes sure a same-day appointment exists too.
    const appointment = await this.visitsService.ensureSameDayAppointment(
      visit,
      tenant,
      user,
      new Date(),
    );
    if (appointment) {
      await this.visitsService.linkAppointment(visit, appointment);
    }

    const encounter = await this.encountersService.create(
      {
        patientId,
        visitId: visit.id,
        encounterType: feature.encounterType,
        reason: feature.form.name,
        notes: [feature.subModule?.name, feature.form.name]
          .filter(Boolean)
          .join(' · '),
      },
      tenant,
      user,
    );

    return { encounter, visit, appointment, admission };
  }
}
