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
];

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
        (field.type === 'select' || field.type === 'radio' || field.type === 'checkbox-group') &&
        (!Array.isArray(field.options) || field.options.length === 0)
      ) {
        errors.push(`Field ${field.key} of type ${field.type} requires options`);
      }

      if (field.type === 'table' && (!Array.isArray(field.columns) || field.columns.length === 0)) {
        errors.push(`Field ${field.key} of type table requires columns`);
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

    if (field.required && (value === undefined || value === null || value === '')) {
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
        if (!Array.isArray(value) || value.some((v) => !field.options?.includes(String(v)))) {
          errors.push(`${field.label || field.key} must be a valid selection`);
        }
        break;
      case 'table':
        if (!Array.isArray(value)) {
          errors.push(`${field.label || field.key} must be a table of rows`);
        }
        break;
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
