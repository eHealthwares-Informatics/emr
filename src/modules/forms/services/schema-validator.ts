import { FormFieldSchema, FormSchema } from '../../../shared/domain/emr.types';

const FIELD_TYPES = [
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
  'inventory-item',
  'generic-product',
  'generic-drug',
  'loinc-test',
  'dicom-test',
  'patient',
  'auth-patient',
  'html',
  'hidden',
  'print',
  'send-form',
  'qr-code',
  'file',
  'practitioner',
  'annotate',
];

const ANNOTATE_TARGETS = ['body', 'dermatome', 'organ'];

const CONTAINER_TYPES = ['section', 'tab', 'col'];

/** Which container types may not appear inside a given container type. */
const NESTING_RULES: Record<string, string[]> = {
  tab: ['tab'],
  col: ['tab', 'col'],
};

export function validateFormSchema(schema: FormSchema): string[] {
  const errors: string[] = [];
  if (!schema || !Array.isArray(schema.fields)) {
    return ['Form schema must contain a fields array'];
  }

  const keys = new Set<string>();

  const walk = (fields: FormFieldSchema[]): void => {
    for (const field of fields) {
      if (!field.key || !field.label) {
        errors.push('Every field must have a key and a label');
        continue;
      }
      if (keys.has(field.key)) {
        errors.push(`Duplicate field key: ${field.key}`);
      }
      keys.add(field.key);

      if (!FIELD_TYPES.includes(field.type)) {
        errors.push(`Field ${field.key} has unsupported type ${field.type}`);
        continue;
      }

      if (field.type === 'tab' || field.type === 'col') {
        const kind = field.type === 'tab' ? 'Tab' : 'Column';
        if (!Array.isArray(field.fields) || field.fields.length === 0) {
          errors.push(`${kind} ${field.key} must contain at least one field`);
        }
        const forbidden = NESTING_RULES[field.type] ?? [];
        for (const child of field.fields ?? []) {
          if (forbidden.includes(child.type)) {
            errors.push(
              `${kind} ${field.key} cannot contain a nested ${child.type} field`,
            );
          }
        }
        if (Array.isArray(field.fields)) {
          walk(field.fields);
        }
      }

      if (
        (field.type === 'select' ||
          field.type === 'radio' ||
          field.type === 'checkbox-group') &&
        (!Array.isArray(field.options) || field.options.length === 0)
      ) {
        errors.push(
          `Field ${field.key} of type ${field.type} requires options`,
        );
      }

      if (
        field.type === 'table' &&
        (!Array.isArray(field.columns) || field.columns.length === 0)
      ) {
        errors.push(`Field ${field.key} of type table requires columns`);
      }

      if (field.type === 'annotate') {
        const cfg = field.annotate;
        if (!cfg || !ANNOTATE_TARGETS.includes(cfg.target)) {
          errors.push(
            `Field ${field.key} of type annotate requires an annotate target (body, dermatome, organ)`,
          );
        } else if (cfg.target === 'organ' && !cfg.organ) {
          errors.push(
            `Field ${field.key} of type annotate with target organ requires an organ`,
          );
        }
      }

      if (field.type === 'html' && !field.html?.trim()) {
        errors.push(`Field ${field.key} of type html requires html content`);
      }

      if (field.type === 'hidden' && !field.valueTemplate?.trim()) {
        errors.push(
          `Field ${field.key} of type hidden requires a value template`,
        );
      }
    }
  };

  walk(schema.fields);
  return errors;
}

export function validateFormData(
  schema: FormSchema,
  data: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  if (!schema?.fields || !Array.isArray(schema.fields)) {
    return ['Form schema is invalid'];
  }

  const validateField = (field: FormFieldSchema): void => {
    if (CONTAINER_TYPES.includes(field.type)) {
      if (field.type === 'tab' || field.type === 'col') {
        for (const child of field.fields ?? []) {
          validateField(child);
        }
      }
      return;
    }

    const value = data?.[field.key];

    // Action/layout fields do not carry submission data.
    if (
      field.type === 'html' ||
      field.type === 'print' ||
      field.type === 'send-form' ||
      field.type === 'qr-code'
    ) {
      return;
    }

    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (field.type === 'annotate' && Array.isArray(value) && value.length === 0);

    if (field.required && isEmpty) {
      errors.push(`${field.label || field.key} is required`);
      return;
    }

    if (value === undefined || value === null || value === '') return;

    switch (field.type) {
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push(`${field.label || field.key} must be a number`);
        }
        break;
      case 'date':
      case 'datetime':
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
          errors.push(`${field.label || field.key} must be a valid date`);
        }
        break;
      case 'checkbox':
        if (typeof value !== 'boolean') {
          errors.push(`${field.label || field.key} must be a boolean`);
        }
        break;
      case 'select':
      case 'radio':
        if (field.options && !field.options.includes(String(value))) {
          errors.push(`${field.label || field.key} has an invalid option`);
        }
        break;
      case 'checkbox-group':
        if (
          !Array.isArray(value) ||
          value.some((v) => !field.options?.includes(String(v)))
        ) {
          errors.push(`${field.label || field.key} must be a valid selection`);
        }
        break;
      case 'table':
        if (!Array.isArray(value)) {
          errors.push(`${field.label || field.key} must be a table of rows`);
        }
        break;
      case 'patient':
      case 'auth-patient':
        if (
          typeof value !== 'object' ||
          Array.isArray(value) ||
          !(value as Record<string, unknown>).patientId
        ) {
          errors.push(
            `${field.label || field.key} must be a selected patient`,
          );
        }
        break;
      case 'dicom-test':
      case 'loinc-test':
        // Concept pickers accept a catalogue entry or free text; both carry a
        // display name.
        if (
          typeof value !== 'object' ||
          Array.isArray(value) ||
          !(
            (value as Record<string, unknown>).name ||
            (value as Record<string, unknown>).code
          )
        ) {
          errors.push(
            `${field.label || field.key} must be a selected or typed test`,
          );
        }
        break;
      case 'hidden':
        if (
          field.valueType === 'number' &&
          (typeof value !== 'number' || Number.isNaN(value))
        ) {
          errors.push(`${field.label || field.key} must be a number`);
        }
        if (field.valueType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${field.label || field.key} must be a boolean`);
        }
        break;
      case 'file': {
        const values = Array.isArray(value) ? value : [value];
        const valid = values.every(
          (entry) =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as Record<string, unknown>).url === 'string',
        );
        if (!valid) {
          errors.push(
            `${field.label || field.key} must contain uploaded file URLs`,
          );
        }
        break;
      }
      case 'practitioner':
        if (
          typeof value !== 'object' ||
          Array.isArray(value) ||
          !(
            (value as Record<string, unknown>).id ||
            (value as Record<string, unknown>).staffId
          )
        ) {
          errors.push(
            `${field.label || field.key} must be a selected practitioner`,
          );
        }
        break;
      case 'item':
      case 'inventory-item':
      case 'generic-product':
      case 'generic-drug':
        // Catalogue pickers store the picked entry ({ id, label, kind, code }).
        if (
          typeof value !== 'object' ||
          Array.isArray(value) ||
          !(value as Record<string, unknown>).id
        ) {
          errors.push(
            `${field.label || field.key} must be a catalogue item`,
          );
        }
        break;
      case 'annotate': {
        const target = field.annotate?.target ?? 'body';
        if (target === 'dermatome') {
          if (typeof value !== 'string') {
            errors.push(
              `${field.label || field.key} must be a single dermatome level`,
            );
          }
        } else if (
          !Array.isArray(value) ||
          value.some((item) => typeof item !== 'string')
        ) {
          errors.push(
            `${field.label || field.key} must be a list of selections`,
          );
        } else if (field.annotate?.multiple === false && value.length > 1) {
          errors.push(
            `${field.label || field.key} allows a single selection`,
          );
        }
        break;
      }
      default:
        if (typeof value !== 'string' && typeof value !== 'number') {
          errors.push(`${field.label || field.key} must be a text value`);
        }
    }
  };

  for (const field of schema.fields) {
    validateField(field);
  }

  return errors;
}
