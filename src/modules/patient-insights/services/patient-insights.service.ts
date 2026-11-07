import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientsService } from '../../patients/services/patients.service';
import { FormDefinitionsService } from '../../forms/services/form-definitions.service';
import { FormSubmissionsService } from '../../forms/services/form-submissions.service';
import { AdmissionsService } from '../../admissions/services/admissions.service';
import { RequestsService } from '../../requests/services/requests.service';
import { MedicationsService } from '../../medications/services/medications.service';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { TenantContext } from '../../../common/tenant-context';
import { PatientOrmEntity } from '../../patients/entities/patient.orm-entity';
import { FormSubmissionOrmEntity } from '../../forms/entities/form-submission.orm-entity';
import { RequestOrmEntity } from '../../requests/entities/request.orm-entity';

const CLINICAL_NOTE_FORM_CODE = 'CLINICAL_NOTE';
const VITALS_FORM_CODE = 'VITALS';
const ACTIVE_REQUEST_STATUSES = new Set(['REQUESTED', 'IN_PROGRESS']);
const DIAGNOSIS_HISTORY_LIMIT = 100;

type DiagnosisEntry = {
  source:
    | 'CLINICAL_NOTE'
    | 'ADMISSION'
    | 'PRESCRIPTION'
    | 'LAB'
    | 'RADIOLOGY'
    | 'OTHER_TEST';
  text: string;
  date: string | null;
  reference: string | null;
  encounterId: string | null;
  status: string | null;
};

function ageFromDateOfBirth(dateOfBirth: string | null): {
  ageYears: number | null;
  ageMonths: number | null;
} {
  if (!dateOfBirth) {
    return { ageYears: null, ageMonths: null };
  }
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) {
    return { ageYears: null, ageMonths: null };
  }
  const today = new Date();
  let months =
    (today.getFullYear() - dob.getFullYear()) * 12 +
    (today.getMonth() - dob.getMonth());
  if (today.getDate() < dob.getDate()) {
    months -= 1;
  }
  const safeMonths = Math.max(0, months);
  return {
    ageYears: Math.floor(safeMonths / 12),
    ageMonths: safeMonths,
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function listQuery(
  values: Partial<ListQueryDto> & Record<string, unknown>,
): ListQueryDto {
  return Object.assign(new ListQueryDto(), values);
}

@Injectable()
export class PatientInsightsService {
  constructor(
    private readonly patients: PatientsService,
    private readonly formDefinitions: FormDefinitionsService,
    private readonly formSubmissions: FormSubmissionsService,
    private readonly admissions: AdmissionsService,
    private readonly requests: RequestsService,
    private readonly medications: MedicationsService,
  ) {}

  /**
   * The tool URLs carry the MRN (`patient.patientId`). The EMR detail route
   * carries the record UUID. Accept either so the same endpoints can be used
   * from the doctor UI and from conversation handlers.
   */
  private async resolvePatient(
    patientRef: string,
    tenant: TenantContext,
  ): Promise<PatientOrmEntity> {
    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        patientRef,
      );
    if (looksLikeUuid) {
      try {
        return await this.patients.get(patientRef, tenant);
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    return this.patients.getByPatientId(patientRef, tenant);
  }

  async biodata(patientRef: string, tenant: TenantContext) {
    const patient = await this.resolvePatient(patientRef, tenant);
    const { ageYears, ageMonths } = ageFromDateOfBirth(patient.dateOfBirth);
    return {
      patientId: patient.patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      otherNames: patient.otherNames,
      dateOfBirth: patient.dateOfBirth,
      ageYears,
      ageMonths,
      gender: patient.gender,
      maritalStatus: patient.maritalStatus,
      bloodGroup: patient.bloodGroup,
      genotype: patient.genotype,
      isActive: patient.isActive,
    };
  }

  async currentDiagnosis(patientRef: string, tenant: TenantContext) {
    const patient = await this.resolvePatient(patientRef, tenant);
    const entries = await this.collectDiagnoses(patient, tenant);
    return {
      available: entries.length > 0,
      patientId: patient.patientId,
      diagnosis: entries[0] ?? null,
    };
  }

  async diagnosisHistory(
    patientRef: string,
    tenant: TenantContext,
    limit = 20,
  ) {
    const patient = await this.resolvePatient(patientRef, tenant);
    const entries = await this.collectDiagnoses(patient, tenant);
    return {
      available: entries.length > 0,
      patientId: patient.patientId,
      total: entries.length,
      items: entries.slice(0, limit),
    };
  }

  async currentVitals(patientRef: string, tenant: TenantContext) {
    const patient = await this.resolvePatient(patientRef, tenant);
    const submissions = await this.submissionsForFormCode(
      patient.patientId,
      VITALS_FORM_CODE,
      tenant,
      1,
    );
    const latest = submissions[0];
    if (!latest) {
      return {
        available: false,
        patientId: patient.patientId,
        message: 'No vitals have been recorded for this patient.',
        vitals: null,
      };
    }
    return {
      available: true,
      patientId: patient.patientId,
      vitals: this.toVitals(latest),
    };
  }

  async currentMedications(
    patientRef: string,
    tenant: TenantContext,
    limit = 20,
  ) {
    const patient = await this.resolvePatient(patientRef, tenant);
    const result = await this.medications.list(
      listQuery({
        patientId: patient.patientId,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
      tenant,
    );
    const active = result.data
      .filter((medication) => medication.status !== 'CANCELLED')
      .slice(0, limit);
    return {
      available: active.length > 0,
      patientId: patient.patientId,
      total: active.length,
      items: active.map((medication) => ({
        medicationNumber: medication.medicationNumber,
        name: medication.name,
        dose: medication.dose,
        doseUnit: medication.doseUnit,
        route: medication.route,
        frequency: medication.frequency,
        duration: medication.duration,
        durationUnit: medication.durationUnit,
        quantity: medication.quantity,
        instructions: medication.instructions,
        status: medication.status,
        administeredAt: toIso(medication.administeredAt),
        administeredByName: medication.administeredByName,
        createdAt: toIso(medication.createdAt),
      })),
    };
  }

  async currentPrescriptions(
    patientRef: string,
    tenant: TenantContext,
    limit = 20,
  ) {
    const patient = await this.resolvePatient(patientRef, tenant);
    return this.currentRequests(
      patient.patientId,
      'PRESCRIPTION',
      tenant,
      limit,
    );
  }

  async currentLaboratoryRequests(
    patientRef: string,
    tenant: TenantContext,
    limit = 20,
  ) {
    const patient = await this.resolvePatient(patientRef, tenant);
    return this.currentRequests(patient.patientId, 'LAB', tenant, limit);
  }

  private async currentRequests(
    patientId: string,
    requestType: 'PRESCRIPTION' | 'LAB',
    tenant: TenantContext,
    limit: number,
  ) {
    const result = await this.requests.listWithItems(
      listQuery({
        patientId,
        requestType,
        limit: 100,
        sortBy: 'requestedAt',
        sortOrder: 'desc',
      }),
      tenant,
    );
    const active = result.data
      .filter((request) => ACTIVE_REQUEST_STATUSES.has(request.status))
      .slice(0, limit);
    return {
      available: active.length > 0,
      patientId,
      requestType,
      total: active.length,
      items: active.map((request) => this.toRequestSummary(request)),
    };
  }

  private toRequestSummary(request: RequestOrmEntity & { items?: unknown[] }) {
    return {
      requestNumber: request.requestNumber,
      requestType: request.requestType,
      status: request.status,
      priority: request.priority,
      diagnosis: request.diagnosis,
      clinicalNotes: request.clinicalNotes,
      requestedAt: toIso(request.requestedAt),
      completedAt: toIso(request.completedAt),
      orderingProviderName: request.orderingProviderName,
      items: (request.items ?? []).map((item) => {
        const row = item as unknown as Record<string, unknown>;
        return {
          name: row.name,
          code: row.code,
          dose: row.dose,
          doseUnit: row.doseUnit,
          route: row.route,
          frequency: row.frequency,
          duration: row.duration,
          durationUnit: row.durationUnit,
          quantity: row.quantity,
          instructions: row.instructions,
          sampleType: row.sampleType,
          specimenNotes: row.specimenNotes,
          modality: row.modality,
          bodyPart: row.bodyPart,
          clinicalIndication: row.clinicalIndication,
          category: row.category,
          notes: row.notes,
        };
      }),
    };
  }

  private async collectDiagnoses(
    patient: PatientOrmEntity,
    tenant: TenantContext,
  ): Promise<DiagnosisEntry[]> {
    const [clinicalNotes, admissions, requests] = await Promise.all([
      this.submissionsForFormCode(
        patient.patientId,
        CLINICAL_NOTE_FORM_CODE,
        tenant,
        DIAGNOSIS_HISTORY_LIMIT,
      ),
      this.admissions.list(
        listQuery({
          patientId: patient.patientId,
          limit: DIAGNOSIS_HISTORY_LIMIT,
        }),
        tenant,
      ),
      this.requests.list(
        listQuery({
          patientId: patient.patientId,
          limit: DIAGNOSIS_HISTORY_LIMIT,
          sortBy: 'requestedAt',
          sortOrder: 'desc',
        }),
        tenant,
      ),
    ]);

    const entries: DiagnosisEntry[] = [];

    for (const submission of clinicalNotes) {
      const text = submission.dataJson?.assessment;
      if (typeof text !== 'string' || !text.trim()) continue;
      entries.push({
        source: 'CLINICAL_NOTE',
        text: text.trim(),
        date: toIso(submission.submittedAt ?? submission.createdAt),
        reference: submission.submissionNumber,
        encounterId: submission.encounterId,
        status: submission.status,
      });
    }

    for (const admission of admissions.data) {
      if (!admission.diagnosis?.trim()) continue;
      entries.push({
        source: 'ADMISSION',
        text: admission.diagnosis.trim(),
        date: toIso(admission.admissionDatetime),
        reference: admission.admissionNumber,
        encounterId: null,
        status: admission.status,
      });
    }

    for (const request of requests.data) {
      if (!request.diagnosis?.trim()) continue;
      entries.push({
        source: request.requestType,
        text: request.diagnosis.trim(),
        date: toIso(request.requestedAt),
        reference: request.requestNumber,
        encounterId: request.encounterId,
        status: request.status,
      });
    }

    const seen = new Set<string>();
    return entries
      .sort((left, right) => {
        const leftTime = left.date ? new Date(left.date).getTime() : 0;
        const rightTime = right.date ? new Date(right.date).getTime() : 0;
        return rightTime - leftTime;
      })
      .filter((entry) => {
        const key = `${entry.source}:${entry.text.toLowerCase()}:${entry.date ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private async submissionsForFormCode(
    patientId: string,
    formCode: string,
    tenant: TenantContext,
    limit: number,
  ): Promise<FormSubmissionOrmEntity[]> {
    let formDefinitionId: string;
    try {
      const form = await this.formDefinitions.getByCode(formCode, tenant);
      formDefinitionId = form.id;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return [];
      }
      throw error;
    }

    const result = await this.formSubmissions.list(
      listQuery({
        patientId,
        formDefinitionId,
        status: 'SUBMITTED',
        limit,
        sortBy: 'submittedAt',
        sortOrder: 'desc',
      }),
      tenant,
    );
    return result.data;
  }

  private toVitals(submission: FormSubmissionOrmEntity) {
    return {
      submissionNumber: submission.submissionNumber,
      formName: submission.formName,
      formVersion: submission.formVersion,
      recordedAt: toIso(submission.submittedAt ?? submission.createdAt),
      recordedBy: submission.submittedByName,
      encounterId: submission.encounterId,
      visitId: submission.visitId,
      data: submission.dataJson,
    };
  }
}
