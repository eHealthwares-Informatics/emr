import {
  AppointmentStatus,
  AppointmentType,
  DepartmentType,
  EncounterType,
  FormCategory,
  FormFieldType,
  PaymentProviderType,
  Priority,
  RequestStatus,
  RequestType,
  SyncStatus,
  VisitStatus,
  VisitType,
} from './enums';

export type BaseEntityType = {
  id: string;
  organizationId: string | null;
  locationId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Identifier = { type: string; value: string };

export type PatientType = BaseEntityType & {
  patientId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  nextOfKinRelationship: string | null;
  identifiers: Identifier[];
  maritalStatus: string | null;
  occupation: string | null;
  bloodGroup: string | null;
  genotype: string | null;
  paymentProviderIds: string[];
  isActive: boolean;
};

export type PaymentProvider = BaseEntityType & {
  code: string;
  name: string;
  type: PaymentProviderType;
  description: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
};

export type Department = BaseEntityType & {
  code: string;
  name: string;
  departmentType: DepartmentType;
  description: string | null;
  isActive: boolean;
};

export type Appointment = BaseEntityType & {
  appointmentNumber: string;
  patientId: string;
  patientName: string;
  appointmentType: AppointmentType;
  date: string;
  startTime: string;
  endTime: string | null;
  providerId: string | null;
  providerName: string | null;
  locationId: string | null;
  scheduleLocation: string | null;
  status: AppointmentStatus;
  priority: Priority;
  reason: string | null;
  notes: string | null;
  visitId: string | null;
  createdById: string | null;
};

export type Visit = BaseEntityType & {
  visitNumber: string;
  patientId: string;
  patientName: string;
  visitType: VisitType;
  status: VisitStatus;
  startDatetime: string;
  stopDatetime: string | null;
  providerId: string | null;
  providerName: string | null;
  locationId: string | null;
  appointmentId: string | null;
  createdById: string | null;
};

export type Encounter = BaseEntityType & {
  encounterNumber: string;
  patientId: string;
  visitId: string | null;
  encounterType: EncounterType;
  providerId: string | null;
  providerName: string | null;
  encounterDatetime: string;
  reason: string | null;
  notes: string | null;
  createdById: string | null;
};

export type FormFieldSchema = {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: unknown;
  rows?: number;
  columns?: { key: string; label: string; type: FormFieldType }[];
  /** Child fields — only used by the 'tab' container type. */
  fields?: FormFieldSchema[];
};

export type FormSchema = {
  fields: FormFieldSchema[];
};

export type FormDefinition = BaseEntityType & {
  code: string;
  name: string;
  description: string | null;
  version: number;
  category: FormCategory;
  schemaJson: FormSchema;
  isPublished: boolean;
  publishedVersion: number | null;
  isActive: boolean;
  createdById: string | null;
};

export type FormSubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'AMENDED';

export type FormSubmission = BaseEntityType & {
  submissionNumber: string;
  formDefinitionId: string;
  formName: string;
  formVersion: number;
  patientId: string;
  visitId: string | null;
  encounterId: string | null;
  dataJson: Record<string, unknown>;
  status: FormSubmissionStatus;
  submittedById: string | null;
  submittedByName: string | null;
  submittedAt: string | null;
  amendedFromId: string | null;
};

export type RequestItem = BaseEntityType & {
  requestId: string;
  name: string;
  code: string | null;
  dose: string | null;
  doseUnit: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  durationUnit: string | null;
  quantity: number | null;
  instructions: string | null;
  testDefinitionId: string | null;
  sampleType: string | null;
  specimenNotes: string | null;
  modality: string | null;
  bodyPart: string | null;
  contrast: boolean;
  clinicalIndication: string | null;
  category: string | null;
  notes: string | null;
};

export type ClinicalRequest = BaseEntityType & {
  requestNumber: string;
  patientId: string;
  patientName: string;
  encounterId: string | null;
  visitId: string | null;
  requestType: RequestType;
  status: RequestStatus;
  priority: Priority;
  orderingProviderId: string | null;
  orderingProviderName: string | null;
  diagnosis: string | null;
  clinicalNotes: string | null;
  externalOrderId: string | null;
  externalReference: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  requestedAt: string;
  completedAt: string | null;
  createdById: string | null;
  items: RequestItem[];
};
