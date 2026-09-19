import { FormDefinitionOrmEntity } from '../../forms/entities/form-definition.orm-entity';
import { FormAccessOrmEntity } from '../../forms/entities/form-access.orm-entity';
import { FormSchema } from '../../../shared/domain/emr.types';
import { FormCategory } from '../../../shared/domain/enums';

export const clinicalNoteSchema: FormSchema = {
  fields: [
    {
      key: 'chiefComplaint',
      label: 'Chief Complaint',
      type: 'textarea',
      required: true,
    },
    {
      key: 'historyOfPresentingIllness',
      label: 'History of Presenting Illness',
      type: 'textarea',
    },
    {
      key: 'pastMedicalHistory',
      label: 'Past Medical History',
      type: 'textarea',
    },
    { key: 'medications', label: 'Current Medications', type: 'textarea' },
    { key: 'allergies', label: 'Allergies', type: 'textarea' },
    { key: 'reviewOfSystems', label: 'Review of Systems', type: 'textarea' },
    { key: 'physicalExam', label: 'Physical Examination', type: 'textarea' },
    { key: 'assessment', label: 'Assessment / Diagnosis', type: 'textarea' },
    { key: 'plan', label: 'Plan', type: 'textarea' },
    { key: 'followUp', label: 'Follow-up Instructions', type: 'textarea' },
  ],
};

export const vitalsSchema: FormSchema = {
  fields: [
    { key: 'temperature', label: 'Temperature (°C)', type: 'number' },
    { key: 'heartRate', label: 'Heart Rate (bpm)', type: 'number' },
    {
      key: 'respiratoryRate',
      label: 'Respiratory Rate (/min)',
      type: 'number',
    },
    {
      key: 'bloodPressureSystolic',
      label: 'Blood Pressure Systolic (mmHg)',
      type: 'number',
    },
    {
      key: 'bloodPressureDiastolic',
      label: 'Blood Pressure Diastolic (mmHg)',
      type: 'number',
    },
    { key: 'oxygenSaturation', label: 'Oxygen Saturation (%)', type: 'number' },
    { key: 'weight', label: 'Weight (kg)', type: 'number' },
    { key: 'height', label: 'Height (cm)', type: 'number' },
    { key: 'bloodGlucose', label: 'Blood Glucose (mg/dL)', type: 'number' },
    { key: 'painScore', label: 'Pain Score (0-10)', type: 'number' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
};

export const starterFormDefinitions: Array<Partial<FormDefinitionOrmEntity>> = [
  {
    code: 'CLINICAL_NOTE',
    name: 'Clinical Note',
    description: 'Standard outpatient clinical consultation note',
    version: 1,
    category: 'CLINICAL_NOTE',
    schemaJson: clinicalNoteSchema,
    isPublished: true,
    publishedVersion: 1,
    isActive: true,
  },
  {
    code: 'VITALS',
    name: 'Vitals',
    description: 'Vital signs recording form',
    version: 1,
    category: 'VITALS',
    schemaJson: vitalsSchema,
    isPublished: true,
    publishedVersion: 1,
    isActive: true,
  },
];

export const starterFormAccess: Array<{
  roleCode?: string;
  userId?: string;
  formCode?: string | null;
  isAllowed?: boolean;
}> = [
  // super_admin is short-circuited in the service; the wildcard row documents intent.
  { roleCode: 'super_admin', formCode: null, isAllowed: true },
  { roleCode: 'admin', formCode: null, isAllowed: true },
  { roleCode: 'emr_clinician', formCode: 'CLINICAL_NOTE' },
  { roleCode: 'emr_clinician', formCode: 'VITALS' },
  { roleCode: 'auditor', formCode: 'VITALS' },
];

export function toFormAccessEntity(
  seed: (typeof starterFormAccess)[number],
  organizationId: string | null,
): FormAccessOrmEntity {
  const entity = new FormAccessOrmEntity();
  entity.userId = seed.userId ?? null;
  entity.roleCode = seed.roleCode ?? null;
  entity.formCode = seed.formCode ?? null;
  entity.isAllowed = seed.isAllowed ?? true;
  entity.organizationId = organizationId;
  return entity;
}

export function toFormEntity(
  seed: Partial<FormDefinitionOrmEntity>,
  organizationId: string | null,
): FormDefinitionOrmEntity {
  const entity = new FormDefinitionOrmEntity();
  entity.code = seed.code as string;
  entity.name = seed.name as string;
  entity.description = seed.description ?? null;
  entity.version = seed.version ?? 1;
  entity.category = seed.category as FormCategory;
  entity.schemaJson = seed.schemaJson as FormSchema;
  entity.isPublished = seed.isPublished ?? false;
  entity.publishedVersion = seed.publishedVersion ?? null;
  entity.isActive = seed.isActive ?? true;
  entity.organizationId = organizationId;
  entity.createdById = null;
  return entity;
}
