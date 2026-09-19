/**
 * Shared mocks for unit-testing services that depend on TypeORM repositories
 * and QueryBuilders. All async methods resolve immediately; tests configure
 * results through the returned object's mutable state.
 */
import { ListQueryDto } from '../shared/dto/list-query.dto';

export interface QueryBuilderMock {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  limit: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getOne: jest.Mock;
  getMany: jest.Mock;
  getManyAndCount: jest.Mock;
  getCount: jest.Mock;
}

export interface RepositoryMock {
  /** Mutable state consulted by createQueryBuilder().getOne()/getManyAndCount(). */
  qbState: { getOne: unknown; list: unknown[]; total: number };
  createQueryBuilder: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  softRemove: jest.Mock;
  delete: jest.Mock;
}

export function repoMock(): RepositoryMock {
  const qbState: RepositoryMock['qbState'] = {
    getOne: null,
    list: [],
    total: 0,
  };

  const qb = {
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    addOrderBy: jest.fn(() => qb),
    limit: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getOne: jest.fn(() => Promise.resolve(qbState.getOne)),
    getMany: jest.fn(() => Promise.resolve(qbState.list)),
    getManyAndCount: jest.fn(() =>
      Promise.resolve([qbState.list, qbState.total] as [unknown[], number]),
    ),
    getCount: jest.fn(() => Promise.resolve(qbState.total)),
  };

  return {
    qbState,
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
    find: jest.fn(),
    // create() returns a shallow copy so mutations in the service (e.g.
    // assigning `.items`) don't leak into the original argument.
    create: jest.fn((entity: unknown) => ({ ...(entity as object) })),
    save: jest.fn(async (entity: unknown) => entity),
    softRemove: jest.fn(async (entity: unknown) => entity),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
  };
}

/**
 * Builds a valid ListQueryDto (with DTO defaults) merged with any overrides.
 * Services type `list()` queries as `ListQueryDto & {...}`, so tests must
 * supply the pagination/sort fields the DTO default provides.
 */
export function listQuery<T extends object>(
  overrides: T = {} as T,
): ListQueryDto & T {
  return Object.assign(new ListQueryDto(), overrides);
}

/** A fixed TenantContext used across most specs. */
export const tenant = {
  organizationId: 'org-1',
  locationId: 'loc-1',
  isGlobalAdmin: false,
};

/** A fixed RequestUser used across most specs. */
export const user = {
  sub: 'user-1',
  organizationId: 'org-1',
  locationId: 'loc-1',
  username: 'dr.ade',
  roles: ['doctor'],
  permissions: [],
};
