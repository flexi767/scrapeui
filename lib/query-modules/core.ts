import { raw } from '@/db/client';
import { PLATFORM_ACCOUNT_COLUMNS, PLATFORM_URL_COLUMNS } from '@/lib/dealers/platformCredentials';
import { notDuplicateExpr, notDuplicateLExpr } from './types';

export interface MakeModel {
  make: string;
  model: string;
}

export function getMakeModels(): Record<string, string[]> {
  const rows = raw
    .prepare(
      `
    SELECT DISTINCT make, model FROM listings WHERE is_active = 1 AND make IS NOT NULL AND ${notDuplicateExpr} ORDER BY make, model
  `,
    )
    .all() as MakeModel[];
  const result: Record<string, string[]> = {};
  for (const r of rows) {
    if (!result[r.make]) result[r.make] = [];
    result[r.make].push(r.model);
  }
  return result;
}

export interface DealerRow {
  id: number;
  slug: string;
  name: string;
  own: number;
  active: number;
  priority: number;
  cars_url?: string | null;
  mobile_url?: string | null;
}

export interface DealerRowFull extends DealerRow {
  mobile_user?: string | null;
  mobile_password?: string | null;
  cars_user?: string | null;
  cars_password?: string | null;
}

export function getAllDealers(): DealerRow[] {
  // Credentials are excluded here; config and auth-sensitive routes use narrower queries.
  return raw
    .prepare(
      `SELECT id, slug, name, own, active, priority, ${PLATFORM_URL_COLUMNS} FROM dealers ORDER BY priority DESC, name`,
    )
    .all() as DealerRow[];
}

export function getOwnDealers({ activeOnly = false }: { activeOnly?: boolean } = {}): DealerRow[] {
  return raw
    .prepare(
      `SELECT id, slug, name, own, active, priority, ${PLATFORM_URL_COLUMNS}
       FROM dealers
       WHERE own = 1${activeOnly ? ' AND active = 1' : ''}
       ORDER BY priority DESC, name`,
    )
    .all() as DealerRow[];
}

export function getActiveDealers(): DealerRow[] {
  return raw
    .prepare(
      `SELECT id, slug, name, own, active, priority, ${PLATFORM_URL_COLUMNS}
       FROM dealers
       WHERE active = 1
       ORDER BY priority DESC, name`,
    )
    .all() as DealerRow[];
}

export function getMobileBgDealers(): DealerRow[] {
  return raw
    .prepare(
      `SELECT id, slug, name, own, active, priority, ${PLATFORM_URL_COLUMNS}
       FROM dealers
       WHERE active = 1 AND mobile_url IS NOT NULL AND mobile_url != ''
       ORDER BY priority DESC, name`,
    )
    .all() as DealerRow[];
}

export function getDealerBySlug(slug: string): DealerRowFull | undefined {
  return raw
    .prepare(
      `SELECT id, slug, name, own, active, priority, ${PLATFORM_ACCOUNT_COLUMNS} FROM dealers WHERE slug = ?`,
    )
    .get(slug) as DealerRowFull | undefined;
}

function distinctListingStrings(col: string, order: 'ASC' | 'DESC' = 'ASC'): string[] {
  return (raw
    .prepare(`SELECT DISTINCT ${col} FROM listings WHERE is_active = 1 AND ${col} IS NOT NULL AND ${notDuplicateExpr} ORDER BY ${col} ${order}`)
    .all() as Record<string, string>[])
    .map((r) => r[col]);
}

export function getDistinctYears(): string[] {
  return distinctListingStrings('reg_year', 'DESC');
}

export function getPriceRange(): { min: number; max: number } | null {
  return getPriceRanges().priceRange;
}

export function getPriceChangeRange(): { min: number; max: number } | null {
  return getPriceRanges().priceChangeRange;
}

export function getPriceRanges(): {
  priceRange: { min: number; max: number } | null;
  priceChangeRange: { min: number; max: number } | null;
} {
  const row = raw
    .prepare(
      `
      SELECT
        MIN(CASE WHEN is_active = 1 AND current_price IS NOT NULL THEN current_price END) as price_min,
        MAX(CASE WHEN is_active = 1 AND current_price IS NOT NULL THEN current_price END) as price_max,
        MIN(CASE WHEN price_change IS NOT NULL THEN price_change END) as price_change_min,
        MAX(CASE WHEN price_change IS NOT NULL THEN price_change END) as price_change_max
      FROM listings
      WHERE ${notDuplicateExpr}
    `,
    )
    .get() as {
      price_min: number | null;
      price_max: number | null;
      price_change_min: number | null;
      price_change_max: number | null;
    };

  return {
    priceRange: row.price_min == null || row.price_max == null
      ? null
      : { min: row.price_min, max: row.price_max },
    priceChangeRange: row.price_change_min == null || row.price_change_max == null
      ? null
      : { min: row.price_change_min, max: row.price_change_max },
  };
}

export function getDistinctFuels(): string[] {
  return distinctListingStrings('fuel');
}

export function getDistinctCategories(): string[] {
  return distinctListingStrings('body_type');
}

// ─── Users ────────────────────────────────────────────────────────

export interface UserRow {
  id: number;
  username: string;
  name: string;
  role: string;
}

export function getAllUsers(): UserRow[] {
  return raw
    .prepare("SELECT id, username, name, role FROM users ORDER BY name")
    .all() as UserRow[];
}

// ─── Labels ───────────────────────────────────────────────────────

export interface LabelRow {
  id: number;
  name: string;
  color: string;
}

export function getAllLabels(): LabelRow[] {
  return raw
    .prepare("SELECT id, name, color FROM labels ORDER BY name")
    .all() as LabelRow[];
}

// ─── Listing Summaries (for pickers) ─────────────────────────────

export interface ListingSummary {
  id: number;
  mobile_id: string;
  title: string;
  make: string;
  model: string;
  reg_year: string;
  current_price: number;
  vat: string | null;
}

export function getListingSummaries(): ListingSummary[] {
  return raw
    .prepare(
      `
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price, l.vat
    FROM listings l
    JOIN dealers d ON l.dealer_id = d.id
    WHERE l.is_active = 1 AND d.own = 1 AND ${notDuplicateLExpr}
    ORDER BY l.make, l.model, l.reg_year
  `,
    )
    .all() as ListingSummary[];
}
