export const APPOINTMENT_TYPES = [
  'CHECKUP',
  'FOLLOW_UP',
  'CONSULTATION',
  'PROCEDURE',
  'EMERGENCY',
  'SURGERY',
  'OTHER',
] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'MISSED',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PRIORITIES = ['ROUTINE', 'URGENT', 'EMERGENCY'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const VISIT_TYPES = [
  'OUTPATIENT',
  'INPATIENT',
  'EMERGENCY',
  'HOME_VISIT',
] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const VISIT_STATUSES = ['ONGOING', 'COMPLETED', 'CANCELLED'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const ENCOUNTER_TYPES = [
  'CONSULTATION',
  'VITALS',
  'HISTORY_AND_PHYSICAL',
  'CLINICAL_NOTE',
  'LAB_RESULTS',
  'DISCHARGE',
  'PROCEDURE',
  'ADMISSION',
  'OTHER',
] as const;
export type EncounterType = (typeof ENCOUNTER_TYPES)[number];

export const ENCOUNTER_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export const FORM_CATEGORIES = [
  'CLINICAL_NOTE',
  'VITALS',
  'ASSESSMENT',
  'SCREENING',
  'PROCEDURE',
  'OTHER',
] as const;
export type FormCategory = (typeof FORM_CATEGORIES)[number];

export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'datetime',
  'select',
  'radio',
  'checkbox',
  'checkbox-group',
  'table',
  'section',
  'tab',
  'col',
  'item',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const STAFF_ROLE_TYPES = [
  'Doctor',
  'Nurse',
  'Technician',
  'Therapist',
  'Admin',
  'Support',
  'Specialist',
  'Finance',
] as const;
export type StaffRoleType = (typeof STAFF_ROLE_TYPES)[number];

export const DEPARTMENT_TYPES = [
  'OPD',
  'INPATIENT',
  'EMERGENCY',
  'LABORATORY',
  'PHARMACY',
  'RADIOLOGY',
  'MATERNITY',
  'SUPPORT',
  'OTHER',
] as const;
export type DepartmentType = (typeof DEPARTMENT_TYPES)[number];

export const STAFF_CATEGORIES = [
  'Medical',
  'Nursing',
  'Allied Health',
  'Pharmacy',
  'Laboratory',
  'Administrative',
  'Support',
  'Other',
] as const;
export type StaffCategory = (typeof STAFF_CATEGORIES)[number];

export const REQUEST_TYPES = [
  'PRESCRIPTION',
  'LAB',
  'RADIOLOGY',
  'OTHER_TEST',
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = [
  'REQUESTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const SYNC_STATUSES = ['NONE', 'PENDING', 'SYNCED', 'FAILED'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const PAYMENT_PROVIDER_TYPES = [
  'CASH',
  'HMO',
  'COMPANY',
  'PROGRAM',
  'OTHER',
] as const;
export type PaymentProviderType = (typeof PAYMENT_PROVIDER_TYPES)[number];

export const WARD_TYPES = [
  'GENERAL',
  'PRIVATE',
  'ICU',
  'PEDIATRIC',
  'MATERNITY',
  'ISOLATION',
  'EMERGENCY',
  'OTHER',
] as const;
export type WardType = (typeof WARD_TYPES)[number];

export const BED_TYPES = [
  'STANDARD',
  'ICU',
  'MATERNITY',
  'ISOLATION',
  'PEDIATRIC',
  'RECOVERY',
] as const;
export type BedType = (typeof BED_TYPES)[number];

export const BED_STATUSES = [
  'AVAILABLE',
  'OCCUPIED',
  'MAINTENANCE',
  'OUT_OF_SERVICE',
] as const;
export type BedStatus = (typeof BED_STATUSES)[number];

export const ADMISSION_STATUSES = [
  'ADMITTED',
  'DISCHARGED',
  'TRANSFERRED',
] as const;
export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];

export const ADMISSION_TYPES = [
  'EMERGENCY',
  'URGENT',
  'ELECTIVE',
  'MATERNITY',
  'SURGICAL',
  'MEDICAL',
] as const;
export type AdmissionType = (typeof ADMISSION_TYPES)[number];

export const DISCHARGE_TYPES = [
  'DISCHARGED_HOME',
  'DIED',
  'REFERRED',
  'TRANSFERRED',
  'SELF_DISCHARGE',
  'AMA',
] as const;
export type DischargeType = (typeof DISCHARGE_TYPES)[number];
