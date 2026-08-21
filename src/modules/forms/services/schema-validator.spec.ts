import { validateFormData, validateFormSchema } from './schema-validator';
import type { FormSchema } from '../../../shared/domain/emr.types';

describe('validateFormSchema', () => {
  it('accepts a valid flat schema', () => {
    const schema: FormSchema = {
      fields: [
        { key: 'name', label: 'Patient name', type: 'text', required: true },
        { key: 'sex', label: 'Sex', type: 'select', options: ['M', 'F'] },
      ],
    };
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it('rejects a schema without a fields array', () => {
    expect(validateFormSchema({} as FormSchema)).toEqual([
      'Form schema must contain a fields array',
    ]);
  });

  it('rejects missing key/label and duplicate keys', () => {
    const schema: FormSchema = {
      fields: [
        { key: 'a', label: 'A', type: 'text' },
        { key: 'a', label: 'B', type: 'text' },
        { key: '', label: 'C', type: 'text' },
      ],
    };
    const errors = validateFormSchema(schema);
    expect(errors).toContain('Duplicate field key: a');
    expect(errors).toContain('Every field must have a key and a label');
  });

  it('rejects unsupported types', () => {
    const schema: FormSchema = {
      fields: [{ key: 'x', label: 'X', type: 'magic' } as never],
    };
    expect(validateFormSchema(schema)).toContain(
      'Field x has unsupported type magic',
    );
  });

  it('requires options for select/radio/checkbox-group and columns for table', () => {
    const schema: FormSchema = {
      fields: [
        { key: 's', label: 'S', type: 'select', options: [] },
        { key: 't', label: 'T', type: 'table', columns: [] },
      ],
    };
    const errors = validateFormSchema(schema);
    expect(errors).toContain('Field s of type select requires options');
    expect(errors).toContain('Field t of type table requires columns');
  });

  it('enforces tab and col container rules with global key uniqueness', () => {
    const schema: FormSchema = {
      fields: [
        {
          key: 'tab1',
          label: 'Vitals',
          type: 'tab',
          fields: [
            { key: 'bp', label: 'BP', type: 'text' },
            { key: 'dup', label: 'Dup', type: 'text' },
          ],
        },
        {
          key: 'tab2',
          label: 'Empty tab',
          type: 'tab',
          fields: [],
        },
        { key: 'dup', label: 'Dup outside', type: 'text' },
        {
          key: 'col1',
          label: 'Col',
          type: 'col',
          fields: [{ key: 'innerTab', label: 'Nested tab', type: 'tab', fields: [] }],
        },
      ],
    };
    const errors = validateFormSchema(schema);
    expect(errors).toContain('Duplicate field key: dup');
    expect(errors).toContain('Tab tab2 must contain at least one field');
    expect(errors).toContain('Column col1 cannot contain a nested tab field');
  });

  it('accepts valid nested tab + col schemas', () => {
    const schema: FormSchema = {
      fields: [
        {
          key: 'tab1',
          label: 'Clinical',
          type: 'tab',
          fields: [
            {
              key: 'col1',
              label: 'Left',
              type: 'col',
              fields: [{ key: 'bp', label: 'BP', type: 'text' }],
            },
          ],
        },
      ],
    };
    expect(validateFormSchema(schema)).toEqual([]);
  });
});

describe('validateFormData', () => {
  const schema: FormSchema = {
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'age', label: 'Age', type: 'number' },
      { key: 'sex', label: 'Sex', type: 'select', options: ['M', 'F'] },
      {
        key: 'tab1',
        label: 'Clinical',
        type: 'tab',
        fields: [
          { key: 'bp', label: 'BP', type: 'text', required: true },
          { key: 'consent', label: 'Consent', type: 'checkbox' },
        ],
      },
    ],
  };

  it('accepts valid data', () => {
    expect(
      validateFormData(schema, {
        name: 'Ada',
        age: 30,
        sex: 'F',
        bp: '120/80',
        consent: true,
      }),
    ).toEqual([]);
  });

  it('flags missing required fields including those inside tabs', () => {
    const errors = validateFormData(schema, { name: 'Ada' });
    expect(errors).toContain('BP is required');
  });

  it('validates types', () => {
    const errors = validateFormData(schema, {
      name: 'Ada',
      age: 'thirty',
      sex: 'X',
      bp: '120/80',
    });
    expect(errors).toContain('Age must be a number');
    expect(errors).toContain('Sex has an invalid option');
  });

  it('flags an invalid schema root', () => {
    expect(validateFormData({} as FormSchema, {})).toEqual([
      'Form schema is invalid',
    ]);
  });
});
