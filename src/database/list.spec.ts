import { applyFilter } from './list';

function qbMock() {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const qb = {
    andWhere: jest.fn((sql: string, params?: Record<string, unknown>) => {
      if (params) {
        calls.push([sql, params]);
      }
      return qb;
    }),
  };
  return { qb, calls };
}

function localYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('applyFilter', () => {
  const alias = 'appointment';
  const field = 'date';

  it('resolves TODAY to an EQUALS filter for the current date', () => {
    const { qb, calls } = qbMock();
    applyFilter(qb as never, alias, field, 'TODAY');
    expect(calls).toHaveLength(1);
    const [sql, params] = calls[0];
    expect(sql).toMatch(/^appointment\.date = :/);
    expect(localYmd(new Date(Object.values(params)[0] as string))).toBe(
      localYmd(new Date()),
    );
  });

  it('resolves TOMMORROW to an EQUALS filter for the next day', () => {
    const { qb, calls } = qbMock();
    applyFilter(qb as never, alias, field, 'TOMMORROW');
    expect(calls).toHaveLength(1);
    const [sql, params] = calls[0];
    expect(sql).toMatch(/^appointment\.date = :/);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(localYmd(new Date(Object.values(params)[0] as string))).toBe(
      localYmd(tomorrow),
    );
  });

  it('resolves THIS_MONTH to a BETWEEN filter', () => {
    const { qb, calls } = qbMock();
    applyFilter(qb as never, alias, field, 'THIS_MONTH');
    expect(calls).toHaveLength(1);
    const [sql, params] = calls[0];
    expect(sql).toMatch(/^appointment\.date BETWEEN :/);
    expect(Object.values(params)).toHaveLength(2);
  });

  it('resolves THIS_YEAR to a BETWEEN filter over Jan 1 - Dec 31', () => {
    const { qb, calls } = qbMock();
    applyFilter(qb as never, alias, field, 'THIS_YEAR');
    const [sql, params] = calls[0];
    expect(sql).toMatch(/^appointment\.date BETWEEN :/);
    expect(Object.values(params)).toEqual([
      `${new Date().getFullYear()}-01-01`,
      `${new Date().getFullYear()}-12-31`,
    ]);
  });
});
