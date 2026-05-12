import { raw } from '@/db/client';
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
  mobile_url?: string;
}

export interface DealerRowFull extends DealerRow {
  mobile_user?: string | null;
  mobile_password?: string | null;
  cars_user?: string | null;
  cars_password?: string | null;
}

export function getAllDealers(): DealerRow[] {
  // Credentials are excluded here — use getDealerById for the config UI where they're needed
  return raw
    .prepare(
      "SELECT id, slug, name, own, active, priority, mobile_url FROM dealers ORDER BY priority DESC, name",
    )
    .all() as DealerRow[];
}

export function getDealerBySlug(slug: string): DealerRowFull | undefined {
  return raw
    .prepare(
      "SELECT id, slug, name, own, active, priority, mobile_url, mobile_user, mobile_password, cars_user, cars_password FROM dealers WHERE slug = ?",
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
  const row = raw
    .prepare(
      `SELECT MIN(current_price) as min, MAX(current_price) as max FROM listings WHERE is_active = 1 AND current_price IS NOT NULL AND ${notDuplicateExpr}`,
    )
    .get() as { min: number | null; max: number | null };
  if (row.min == null || row.max == null) return null;
  return { min: row.min, max: row.max };
}

export function getPriceChangeRange(): { min: number; max: number } | null {
  const row = raw
    .prepare(
      `SELECT MIN(price_change) as min, MAX(price_change) as max FROM listings WHERE price_change IS NOT NULL AND ${notDuplicateExpr}`,
    )
    .get() as { min: number | null; max: number | null };
  if (row.min == null || row.max == null) return null;
  return { min: row.min, max: row.max };
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
