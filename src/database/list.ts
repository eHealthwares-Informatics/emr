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

function resolveField(alias: string, field: string) {
  return field.includes('.') ? field : `${alias}.${field}`;
}

function paramName(field: string, type: string) {
  return `${field.replace('.', '_')}_${type}_${Date.now()}`;
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
