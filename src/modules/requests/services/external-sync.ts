import type { RequestItemOrmEntity } from '../entities/request-item.orm-entity';

export type ExternalItemKind =
  | 'STOCK_ITEM'
  | 'GENERIC_PRODUCT'
  | 'GENERIC_DRUG'
  | 'LOINC_TEST';

/**
 * Kind-aware catalog code for a request item line.
 * Falls back to the legacy `code` column when no kind was recorded
 * (requests created before the picker recorded kinds).
 */
export function externalItemCode(item: RequestItemOrmEntity): string | null {
  if (item.itemKind === 'STOCK_ITEM' || item.itemKind === 'GENERIC_PRODUCT') {
    return item.code ?? null;
  }
  if (item.itemKind === 'GENERIC_DRUG') {
    return item.code ?? null;
  }
  return item.code ?? null;
}

/**
 * Stable cross-system reference for a line. Generated when the client did not
 * send one: `<KIND>:<code>` when the kind is known, else
 * `<requestId>:<code>` for legacy rows so downstream systems can still dedupe.
 */
export function externalReferenceCode(item: RequestItemOrmEntity): string | null {
  if (item.referenceCode) return item.referenceCode;
  if (item.itemKind && item.code) return `${item.itemKind}:${item.code}`;
  if (item.code) return `${item.requestId}:${item.code}`;
  return null;
}
