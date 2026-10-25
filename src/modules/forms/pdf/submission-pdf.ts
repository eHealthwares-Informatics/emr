import type { FormSubmissionOrmEntity } from '../entities/form-submission.orm-entity';
import type { FormDefinitionOrmEntity } from '../entities/form-definition.orm-entity';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '—';
    }
    if (value.every((item) => typeof item === 'object' && item !== null)) {
      const rows = value as Array<Record<string, unknown>>;
      const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
      const head = keys
        .map(
          (key) =>
            `<td style="font-size: 8; color: #666666; font-weight: bold;">${escapeHtml(key)}</td>`,
        )
        .join('');
      const body = rows
        .map(
          (row) =>
            `<tr>${keys.map((key) => `<td style="font-size: 9;">${renderValue(row[key])}</td>`).join('')}</tr>`,
        )
        .join('');
      return `<table>${head ? `<tr>${head}</tr>` : ''}${body}</table>`;
    }
    return value.map((item) => renderValue(item)).join(', ');
  }
  if (typeof value === 'object') {
    return escapeHtml(JSON.stringify(value));
  }
  return escapeHtml(String(value));
}

/** Humanize a region / structure id: `right-knee` → `Right knee`. */
function humanizeId(value: string): string {
  const text = value.replace(/[-_]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/**
 * Annotate values are stored as ids (body/organ) or a single dermatome level.
 * Print them as readable labels rather than raw ids.
 */
function renderAnnotateValue(value: unknown, target: string): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (target === 'dermatome') {
    return escapeHtml(String(value));
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '—';
    }
    return value.map((item) => escapeHtml(humanizeId(String(item)))).join(', ');
  }
  return escapeHtml(humanizeId(String(value)));
}

/**
 * HTML template for a submission PDF. Kept to the tag/CSS subset supported by
 * html-to-pdfmake: headings, paragraphs, spans, and tables with inline styles.
 */
export function submissionPdfHtml(
  submission: FormSubmissionOrmEntity,
  form?: FormDefinitionOrmEntity | null,
): string {
  const labels = new Map<string, string>();
  const fieldMeta = new Map<
    string,
    { type?: string; annotate?: { target?: string } }
  >();
  const collectLabels = (
    fields: Array<{
      key: string;
      label: string;
      type?: string;
      annotate?: { target?: string };
      fields?: unknown[];
    }>,
  ): void => {
    for (const field of fields) {
      labels.set(field.key, field.label);
      fieldMeta.set(field.key, { type: field.type, annotate: field.annotate });
      if (Array.isArray(field.fields)) {
        collectLabels(
          field.fields as Array<{
            key: string;
            label: string;
            type?: string;
            annotate?: { target?: string };
            fields?: unknown[];
          }>,
        );
      }
    }
  };
  collectLabels(form?.schemaJson?.fields ?? []);

  const fieldRows = Object.entries(submission.dataJson ?? {})
    .map(([key, value]) => {
      const label = labels.get(key) ?? key;
      const meta = fieldMeta.get(key);
      const rendered =
        meta?.type === 'annotate'
          ? renderAnnotateValue(value, meta.annotate?.target ?? 'body')
          : renderValue(value);
      return `<tr>
        <td style="width: 30%; font-size: 9; color: #666666; font-weight: bold; padding: 4 8 4 0;">${escapeHtml(label)}</td>
        <td style="font-size: 10; padding: 4 0;">${rendered}</td>
      </tr>`;
    })
    .join('');

  const generatedAt = new Date().toLocaleString();
  const submittedAt = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString()
    : '—';

  return `<div>
  <table style="width: 100%; margin-bottom: 16;">
    <tr>
      <td>
        <span style="font-size: 16; font-weight: bold;">EMR — Clinical Documentation</span><br />
        <span style="font-size: 9; color: #666666;">Electronic Medical Record</span>
      </td>
      <td style="text-align: right; font-size: 9; color: #555555;">
        Submission ${escapeHtml(submission.submissionNumber)}<br />
        Generated ${escapeHtml(generatedAt)}
      </td>
    </tr>
  </table>

  <h1 style="font-size: 14; margin: 0 0 4 0;">
    ${escapeHtml(submission.formName)}
    <span style="font-size: 10; color: #666666;">v${submission.formVersion}</span>
  </h1>
  <p style="font-size: 9; color: #666666;">
    Status: ${escapeHtml(submission.status)} &middot; Patient MRN: ${escapeHtml(submission.patientId)} &middot;
    Submitted by ${escapeHtml(submission.submittedByName ?? 'Unknown')} &middot; ${escapeHtml(submittedAt)}
  </p>
  ${submission.encounterId || submission.visitId ? `<p style="font-size: 9; color: #666666; margin-top: 2;">Encounter ${escapeHtml(submission.encounterId ?? '—')} &middot; Visit ${escapeHtml(submission.visitId ?? '—')}</p>` : ''}

  <table style="width: 100%; margin-top: 14;">
    ${fieldRows || '<tr><td style="font-size: 10;">No data recorded.</td></tr>'}
  </table>

  <p style="font-size: 9; color: #888888; margin-top: 24;">
    This document was generated from the electronic medical record on ${escapeHtml(generatedAt)}.
    ${submission.amendedFromId ? `Amended from submission ${escapeHtml(submission.amendedFromId)}.` : ''}
  </p>
</div>`;
}
