import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

type FilterQuery = {
  page?: number;
  limit?: number;
  filters?: Record<string, any>;
};

type ListResult<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta: any;
};

export function applyFilters(
  qb: SelectQueryBuilder<any>,
  alias: string,
  filters: Record<string, any>,
) {
  Object.entries(filters).forEach(([field, raw]) => {
    if (!raw) return;
    const { type, value, valueTo } = parseFilter(raw);
    applyFilter(qb, alias, field, type, value, valueTo);
  });
}

function parseFilter(raw: string) {
  const [type, value, valueTo] = raw.split('|');
  return { type, value, valueTo };
}

/**
 * Extract the value component from a DataPageShell/column-filter DSL value
 * (`TYPE|value|valueTo`). Returns the value only when the raw string is DSL-
 * encoded; plain values pass through as-is for backward compatibility.
 */
export function dslFilterValue(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.includes('|') ? raw.split('|')[1] : raw;
}

function resolveField(alias: string, field: string) {
  return field.includes('.') ? field : `${alias}.${field}`;
}

function paramName(field: string, type: string) {
  return `${field.replace('.', '_')}_${type}_${Date.now()}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function applyFilter(
  qb: SelectQueryBuilder<any>,
  alias: string,
  field: string,
  type: string,
  value?: any,
  valueTo?: any,
) {
  const column = resolveField(alias, field);
  const param = paramName(field, type);

  // Date shorthands (frontend ColumnTypeFilters.DATE) resolve to concrete
  // date boundaries server-side so `date=TODAY|` etc. work without a value.
  if (type === 'TODAY') {
    return applyFilter(
      qb,
      alias,
      field,
      'EQUALS',
      toDateString(new Date()),
      undefined,
    );
  }
  if (type === 'TOMMORROW' || type === 'TOMORROW') {
    return applyFilter(
      qb,
      alias,
      field,
      'EQUALS',
      toDateString(addDays(new Date(), 1)),
      undefined,
    );
  }
  if (type === 'YESTERDAY') {
    return applyFilter(
      qb,
      alias,
      field,
      'EQUALS',
      toDateString(addDays(new Date(), -1)),
      undefined,
    );
  }
  if (type === 'NEXT_24_HOURS') {
    const now = new Date();
    return applyFilter(
      qb,
      alias,
      field,
      'BETWEEN',
      toDateString(now),
      toDateString(addDays(now, 1)),
    );
  }
  if (type === 'THIS_MONTH') {
    const first = new Date();
    first.setDate(1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return applyFilter(
      qb,
      alias,
      field,
      'BETWEEN',
      toDateString(first),
      toDateString(last),
    );
  }
  if (type === 'LAST_MONTH') {
    const first = new Date();
    first.setDate(1);
    const prev = new Date(first.getFullYear(), first.getMonth() - 1, 1);
    const last = new Date(first.getFullYear(), first.getMonth(), 0);
    return applyFilter(
      qb,
      alias,
      field,
      'BETWEEN',
      toDateString(prev),
      toDateString(last),
    );
  }
  if (type === 'NEXT_MONTH') {
    const first = new Date();
    first.setDate(1);
    const next = new Date(first.getFullYear(), first.getMonth() + 1, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 2, 0);
    return applyFilter(
      qb,
      alias,
      field,
      'BETWEEN',
      toDateString(next),
      toDateString(last),
    );
  }
  if (type === 'THIS_YEAR') {
    const year = new Date().getFullYear();
    return applyFilter(
      qb,
      alias,
      field,
      'BETWEEN',
      `${year}-01-01`,
      `${year}-12-31`,
    );
  }

  switch (type) {
    case 'EQUALS':
      qb.andWhere(`${column} = :${param}`, { [param]: value });
      break;
    case 'NOT_EQUALS':
      qb.andWhere(`${column} != :${param}`, { [param]: value });
      break;
    case 'CONTAINS':
      qb.andWhere(`${column} LIKE :${param}`, { [param]: `%${value}%` });
      break;
    case 'FUZZY_MATCH':
      qb.andWhere(`${column} ILIKE :${param}`, { [param]: `%${value}%` });
      break;
    case 'GREATER_THAN':
      qb.andWhere(`${column} > :${param}`, { [param]: value });
      break;
    case 'GREATER_THAN_OR_EQUAL':
      qb.andWhere(`${column} >= :${param}`, { [param]: value });
      break;
    case 'LESS_THAN':
      qb.andWhere(`${column} < :${param}`, { [param]: value });
      break;
    case 'LESS_THAN_OR_EQUAL':
      qb.andWhere(`${column} <= :${param}`, { [param]: value });
      break;
    case 'BETWEEN': {
      const from = `${param}_from`;
      const to = `${param}_to`;
      qb.andWhere(`${column} BETWEEN :${from} AND :${to}`, {
        [from]: value,
        [to]: valueTo,
      });
      break;
    }
    case 'MISSING':
      qb.andWhere(`${column} IS NULL`);
      break;
  }
}

const SORT_COLUMN = /^[a-zA-Z0-9_.]+$/;

export function applySort(
  qb: SelectQueryBuilder<any>,
  alias: string,
  sortBy: string,
  sortOrder: 'asc' | 'desc',
) {
  const safe = SORT_COLUMN.test(sortBy) ? sortBy : 'createdAt';
  const column = resolveField(alias, safe);
  qb.orderBy(column, (sortOrder || 'ASC').toUpperCase() as 'ASC' | 'DESC');
}

export async function paginate<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: FilterQuery,
): Promise<ListResult<T>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  if (query.filters) {
    applyFilters(qb, qb.alias, query.filters);
  }

  qb.skip((page - 1) * limit).take(limit);
  const [data, total] = await qb.getManyAndCount();
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: { page, limit, total, totalPages },
    meta: { page, limit, total },
  };
}
