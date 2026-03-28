# /editown Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/editown` page that shows own-dealer listings with inline editing for title, price, vat, kaparo, and ad_status, plus a `needs_sync` indicator for locally-edited listings.

**Architecture:** Server component page fetches own-dealer listings and passes them to a client-side `OwnListingsTable` component that manages inline edit state. Edits are saved via a new `PATCH /api/listings/[mobileId]` route, which sets `needs_sync = 1` and returns the updated row. `FilterBar` and `RangeFilter` get a `basePath` prop so they work on `/editown` instead of always navigating to `/listings`.

**Tech Stack:** Next.js 15 (App Router), SQLite via `better-sqlite3` raw queries (NOT Drizzle ORM query builder — the project uses raw SQL through `db/client.ts`'s `raw` instance), Tailwind CSS, Sonner toasts (`import { toast } from 'sonner'`).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `db/schema.ts` | Modify | Add `needsSync` column |
| `lib/queries.ts` | Modify | Add `OwnListingRow`, `getOwnListings`, `getOwnListingByMobileId` |
| `components/RangeFilter.tsx` | Modify | Add `basePath` prop to outer and inner components |
| `components/PriceChangeFilter.tsx` | Modify | Thread `basePath` to `RangeFilter` |
| `components/FilterBar.tsx` | Modify | Add `basePath` prop, replace all hardcoded `/listings?`, add "Edit Own" nav link, pass `basePath` to `RangeFilter` and `PriceChangeFilter` |
| `app/api/listings/[mobileId]/route.ts` | Create | PATCH handler — validate, update, return updated row |
| `components/OwnListingsTable.tsx` | Create | Client table with inline edit state |
| `app/editown/page.tsx` | Modify (replace) | Server page — replace re-export stub with full implementation |

---

## Task 1: Add `needs_sync` column to schema and push

**Files:**
- Modify: `db/schema.ts`

- [ ] **Step 1: Add the column to the Drizzle schema**

In `db/schema.ts`, add `needsSync` to the `listings` table definition after `isActive`:

```ts
isActive: integer('is_active').default(1),
needsSync: integer('needs_sync').default(0),
```

- [ ] **Step 2: Push the schema to the database**

```bash
npx drizzle-kit push
```

Expected: output confirms the `needs_sync` column was added to the `listings` table. No data loss.

- [ ] **Step 3: Verify the column exists**

```bash
node -e "const D = require('better-sqlite3'); const db = new D(process.env.DB_PATH || '/Users/v/dev/scraped/listings.db'); console.log(db.pragma('table_info(listings)').map(c => c.name));"
```

Expected: `needs_sync` appears in the column list.

- [ ] **Step 4: Commit**

```bash
git add db/schema.ts
git commit -m "feat: add needs_sync column to listings table"
```

---

## Task 2: Add queries

**Files:**
- Modify: `lib/queries.ts`

- [ ] **Step 1: Add `OwnListingRow` interface**

After the existing `ListingRow` interface (around line 27), add:

```ts
export interface OwnListingRow extends ListingRow {
  needs_sync: number;
}
```

- [ ] **Step 2: Add `getOwnListings` function**

After the closing `}` of `getListings`, add this new function. Copy `getListings` exactly but make these three changes:
1. Add `AND d.own = 1` to the `wheres` array initializer: `const wheres: string[] = ['l.is_active = 1', 'd.active = 1', 'd.own = 1'];`
2. Add `l.needs_sync` to the SELECT statement (after `l.is_active,`): `l.needs_sync,`
3. Cast result as `OwnListingRow[]` instead of `ListingRow[]`

Full function:

```ts
export function getOwnListings(filters: ListingFilters = {}) {
  const {
    make = '',
    model = '',
    dealerSlugs = [],
    years = [],
    statuses = [],
    vatValues = [],
    fuels = [],
    priceMin = null,
    priceMax = null,
    priceChangeMin = null,
    priceChangeMax = null,
    kaparo = '',
    sort = 'last_edit',
    order = 'desc',
    search = '',
    page = 1,
    limit = 25,
  } = filters;

  const wheres: string[] = ['l.is_active = 1', 'd.active = 1', 'd.own = 1'];
  const params: (string | number)[] = [];

  if (make) { wheres.push('l.make = ?'); params.push(make); }
  if (model) { wheres.push('l.model = ?'); params.push(model); }

  if (statuses.length > 0) {
    const ph = statuses.map(() => '?').join(',');
    wheres.push(`l.ad_status IN (${ph})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes('null');
    const nonNull = vatValues.filter(v => v !== 'null');
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      const ph = nonNull.map(() => '?').join(',');
      clauses.push(`l.vat IN (${ph})`);
      params.push(...nonNull);
    }
    if (includeNull) clauses.push('l.vat IS NULL');
    if (clauses.length > 0) wheres.push(`(${clauses.join(' OR ')})`);
  }
  if (fuels.length > 0) {
    const ph = fuels.map(() => '?').join(',');
    wheres.push(`l.fuel IN (${ph})`);
    params.push(...fuels);
  }
  if (priceMin !== null) { wheres.push('l.current_price >= ?'); params.push(priceMin); }
  if (priceMax !== null) { wheres.push('l.current_price <= ?'); params.push(priceMax); }
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push('l.price_change IS NOT NULL');
    if (priceChangeMin !== null) { wheres.push('l.price_change >= ?'); params.push(priceChangeMin); }
    if (priceChangeMax !== null) { wheres.push('l.price_change <= ?'); params.push(priceChangeMax); }
  }
  if (kaparo) {
    wheres.push('l.kaparo = ?');
    params.push(kaparo === 'yes' ? 1 : 0);
  }
  if (years.length > 0) {
    const ph = years.map(() => '?').join(',');
    wheres.push(`l.reg_year IN (${ph})`);
    params.push(...years);
  }
  if (search) {
    wheres.push('(l.title LIKE ? OR l.make LIKE ? OR l.model LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    const ph = dealerSlugs.map(() => '?').join(',');
    wheres.push(`d.slug IN (${ph})`);
    params.push(...dealerSlugs);
  }

  const where = `WHERE ${wheres.join(' AND ')}`;
  const sortCol = VALID_SORT[sort] ?? 'l.last_edit';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT
      l.id, l.mobile_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage, l.fuel,
      l.current_price, l.price_change, l.vat, l.kaparo, l.ad_status, l.last_edit, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.is_active, l.needs_sync,
      d.name as dealer_name, d.slug as dealer_slug
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as OwnListingRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
  `).get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}
```

- [ ] **Step 3: Add `getOwnListingByMobileId` function**

Add after `getOwnListings`:

```ts
export function getOwnListingByMobileId(mobileId: string): OwnListingRow | null {
  return raw.prepare(`
    SELECT
      l.id, l.mobile_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage, l.fuel,
      l.current_price, l.price_change, l.vat, l.kaparo, l.ad_status, l.last_edit, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.is_active, l.needs_sync,
      d.name as dealer_name, d.slug as dealer_slug
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.mobile_id = ? AND d.own = 1
  `).get(mobileId) as OwnListingRow | null;
}
```

- [ ] **Step 4: Verify the app still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/queries.ts
git commit -m "feat: add OwnListingRow type and getOwnListings/getOwnListingByMobileId queries"
```

---

## Task 3: Add PATCH API route for listings

**Files:**
- Create: `app/api/listings/[mobileId]/route.ts`

Note: the directory `app/api/listings/[mobileId]/` does not exist yet — create it.

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest } from 'next/server';
import { raw } from '@/db/client';
import { getOwnListingByMobileId } from '@/lib/queries';

const VALID_VAT = new Set(['', 'included', 'exempt', 'excluded']);
const VALID_AD_STATUS = new Set(['none', 'TOP', 'VIP']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ mobileId: string }> },
) {
  const { mobileId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, current_price, vat, kaparo, ad_status } = body;

  // Validate
  if (typeof title !== 'string' || title.trim() === '') {
    return Response.json({ error: 'Title is required' }, { status: 400 });
  }
  if (typeof current_price !== 'number' || !Number.isInteger(current_price) || current_price < 0) {
    return Response.json({ error: 'Price must be a non-negative integer' }, { status: 400 });
  }
  if (typeof vat !== 'string' || !VALID_VAT.has(vat)) {
    return Response.json({ error: 'Invalid VAT value' }, { status: 400 });
  }
  if (kaparo !== 0 && kaparo !== 1) {
    return Response.json({ error: 'Kaparo must be 0 or 1' }, { status: 400 });
  }
  if (typeof ad_status !== 'string' || !VALID_AD_STATUS.has(ad_status)) {
    return Response.json({ error: 'Invalid ad_status value' }, { status: 400 });
  }

  // 404 check
  const existing = getOwnListingByMobileId(mobileId);
  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    raw.prepare(`
      UPDATE listings
      SET title = ?, current_price = ?, vat = ?, kaparo = ?, ad_status = ?, needs_sync = 1
      WHERE mobile_id = ?
    `).run(title.trim(), current_price, vat === '' ? null : vat, kaparo, ad_status, mobileId);
  } catch {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }

  const updated = getOwnListingByMobileId(mobileId);
  if (!updated) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }

  return Response.json(updated);
}
```

- [ ] **Step 2: Manually verify the route works**

Start the dev server (`npm run dev`) and run in another terminal:

```bash
# Replace MOBILE_ID with an actual mobile_id from your own-dealer listings
curl -s -X PATCH http://localhost:3000/api/listings/MOBILE_ID \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test Title","current_price":15000,"vat":"included","kaparo":0,"ad_status":"none"}' | jq .
```

Expected: JSON object with the updated listing row, including `needs_sync: 1`.

```bash
# Test 404
curl -s -X PATCH http://localhost:3000/api/listings/nonexistent \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test","current_price":1000,"vat":"","kaparo":0,"ad_status":"none"}' | jq .
```

Expected: `{"error": "Not found"}` with status 404.

- [ ] **Step 3: Commit**

```bash
git add app/api/listings/
git commit -m "feat: add PATCH /api/listings/[mobileId] route"
```

---

## Task 4: Add `basePath` to RangeFilter and PriceChangeFilter

**Files:**
- Modify: `components/RangeFilter.tsx`
- Modify: `components/PriceChangeFilter.tsx`

- [ ] **Step 1: Update outer `Props` interface in RangeFilter**

Add `basePath?: string` to the outer `Props` interface:

```ts
interface Props {
  min: number;
  max: number;
  paramLow: string;
  paramHigh: string;
  label?: string;
  fmt?: (v: number) => string;
  basePath?: string;
}
```

- [ ] **Step 2: Pass `basePath` from outer `RangeFilter` to `RangeFilterInner`**

In the outer `RangeFilter` function, destructure `basePath` from props and pass it to `<RangeFilterInner>`:

```ts
export default function RangeFilter({ min: rawMin, max: rawMax, paramLow, paramHigh, label, fmt, basePath = '/listings' }: Props) {
  // ... existing logic unchanged ...
  return (
    <RangeFilterInner
      key={resetKey}
      min={min}
      max={max}
      initialLow={initialLow}
      initialHigh={initialHigh}
      paramLow={paramLow}
      paramHigh={paramHigh}
      label={label}
      fmt={fmt}
      searchParamsString={searchParams.toString()}
      basePath={basePath}
    />
  );
}
```

- [ ] **Step 3: Update `InnerProps` and `RangeFilterInner`**

Add `basePath: string` to `InnerProps`:

```ts
interface InnerProps {
  min: number;
  max: number;
  initialLow: number;
  initialHigh: number;
  paramLow: string;
  paramHigh: string;
  label?: string;
  fmt?: (v: number) => string;
  searchParamsString: string;
  basePath: string;
}
```

In `RangeFilterInner`, destructure `basePath` from props and use it in the push call:

```ts
function RangeFilterInner({ min, max, initialLow, initialHigh, paramLow, paramHigh, label, fmt, searchParamsString, basePath }: InnerProps) {
  // ...
  const push = useCallback((lo: number, hi: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(searchParamsString);
      p.delete('page');
      if (lo === min) p.delete(paramLow); else p.set(paramLow, String(lo));
      if (hi === max) p.delete(paramHigh); else p.set(paramHigh, String(hi));
      router.push(`${basePath}?${p.toString()}`);
    }, 300);
  }, [searchParamsString, router, min, max, paramLow, paramHigh, basePath]);
  // ...
}
```

- [ ] **Step 4: Update PriceChangeFilter to accept and pass `basePath`**

```ts
'use client';

import RangeFilter from './RangeFilter';

interface Props { min: number; max: number; basePath?: string; }

const fmt = (v: number) => v > 0 ? `+${v}` : String(v);

export default function PriceChangeFilter({ min, max, basePath }: Props) {
  return <RangeFilter min={min} max={max} paramLow="pc_min" paramHigh="pc_max" label="Δ" fmt={fmt} basePath={basePath} />;
}
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add components/RangeFilter.tsx components/PriceChangeFilter.tsx
git commit -m "feat: add basePath prop to RangeFilter and PriceChangeFilter"
```

---

## Task 5: Update FilterBar with `basePath` and "Edit Own" nav link

**Files:**
- Modify: `components/FilterBar.tsx`

- [ ] **Step 1: Add `basePath` to `Props` interface**

```ts
interface Props {
  makes: string[];
  makeModels: Record<string, string[]>;
  allDealers: { slug: string; name: string; own: number }[];
  allYears: string[];
  allFuels: string[];
  total: number;
  priceChangeRange?: { min: number; max: number } | null;
  priceRange?: { min: number; max: number } | null;
  basePath?: string;
}
```

- [ ] **Step 2: Destructure `basePath` in the component function**

```ts
export default function FilterBar({ makes, makeModels, allDealers, allYears, allFuels, total, priceChangeRange, priceRange, basePath = '/listings' }: Props) {
```

- [ ] **Step 3: Replace all hardcoded `/listings?` with `${basePath}?`**

There are **9 occurrences** of `router.push('/listings?...` or `router.push(\`/listings?...`) in this file. Replace every one:

| Location | Old | New |
|----------|-----|-----|
| `onMakeChange` | `` router.push(`/listings?${buildParams(...)}`) `` | `` router.push(`${basePath}?${buildParams(...)}`) `` |
| `onModelChange` | same pattern | same fix |
| `onDealerToggle` | same pattern | same fix |
| `onSearchChange` | same pattern | same fix |
| `onClearAll` | same pattern | same fix |
| `onYearToggle` | same pattern | same fix |
| `onStatusToggle` | same pattern | same fix |
| `onVatToggle` | same pattern | same fix |
| `onFuelToggle` | same pattern | same fix |

Also 5 inline `onClick` button handlers in the dropdown JSX (Clear dealers, Clear paid, Clear VAT, Clear Fuel, Clear years) — each has `router.push('/listings?${buildParams(...)}')`. Replace those too.

After replacing: `grep -c "'/listings?" components/FilterBar.tsx` should return `0`.

- [ ] **Step 4: Pass `basePath` to `RangeFilter` and `PriceChangeFilter`**

Find the two range component usages and add `basePath={basePath}`:

```tsx
{/* Price range slider */}
{priceRange && (
  <RangeFilter min={priceRange.min} max={priceRange.max} paramLow="p_min" paramHigh="p_max"
    fmt={v => `€${(v/1000).toFixed(0)}k`} basePath={basePath} />
)}

{/* Price change slider */}
{priceChangeRange && (
  <PriceChangeFilter min={priceChangeRange.min} max={priceChangeRange.max} basePath={basePath} />
)}
```

- [ ] **Step 5: Add "Edit Own" nav link**

Find the nav area at the bottom of the JSX (around line 392) and add the "Edit Own" link before Config:

```tsx
<div className="ml-auto flex items-center gap-3 text-sm text-gray-400">
  <span>{total.toLocaleString()} ad{total !== 1 ? 's' : ''}</span>
  <a href="/editown" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Edit Own</a>
  <a href="/config" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">⚙ Config</a>
</div>
```

- [ ] **Step 6: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Verify `/listings` still works**

Open `http://localhost:3000/listings` and confirm all filter interactions still navigate to `/listings?...` (not `/editown?...`).

- [ ] **Step 8: Commit**

```bash
git add components/FilterBar.tsx
git commit -m "feat: add basePath prop to FilterBar and Edit Own nav link"
```

---

## Task 6: Create OwnListingsTable client component

**Files:**
- Create: `components/OwnListingsTable.tsx`

This component handles all inline edit state for the `/editown` table. Model it after `DealersManager.tsx` (`components/DealersManager.tsx`) — same pattern of `editingId`, `editForm`, `saving` state, `startEdit`, `saveEdit`.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { OwnListingRow } from '@/lib/queries';
import { buildImageList, formatDate, formatMileage, formatPrice, parseJson } from '@/lib/utils';

interface EditForm {
  title: string;
  current_price: number;
  vat: string;
  kaparo: number;
  ad_status: string;
}

function AdStatusBadge({ status }: { status: string }) {
  const s = status ?? 'none';
  if (!s || s === 'none') return <span className="text-gray-600">—</span>;
  if (s.toUpperCase() === 'TOP')
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: '#1a6496' }}>TOP</span>;
  if (s.toUpperCase() === 'VIP')
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: '#c0392b' }}>VIP</span>;
  return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{s}</span>;
}

export default function OwnListingsTable({ initialRows }: { initialRows: OwnListingRow[] }) {
  const [rows, setRows] = useState<OwnListingRow[]>(initialRows);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: '', current_price: 0, vat: '', kaparo: 0, ad_status: 'none' });
  const [saving, setSaving] = useState(false);

  function startEdit(row: OwnListingRow) {
    if (saving) return;
    setEditingId(row.mobile_id);
    setEditForm({
      title: row.title ?? '',
      current_price: row.current_price ?? 0,
      vat: row.vat ?? '',
      kaparo: row.kaparo ?? 0,
      ad_status: row.ad_status ?? 'none',
    });
  }

  async function saveEdit(mobileId: string) {
    if (editForm.current_price < 0) {
      toast.error('Price must be a non-negative integer');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${mobileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save');
        return;
      }
      setRows(prev => prev.map(r => r.mobile_id === mobileId ? data as OwnListingRow : r));
      setEditingId(null);
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700/60">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
            <th className="w-6 px-2 py-1.5"></th>
            <th className="w-16 px-3 py-1.5 text-left">Img</th>
            <th className="px-3 py-1.5 text-left">Make / Model</th>
            <th className="px-3 py-1.5 text-left">Title</th>
            <th className="px-3 py-1.5 text-left">Dealer</th>
            <th className="px-2 py-1.5 text-center w-14">Ad Status</th>
            <th className="pl-1 pr-3 py-1.5 text-right">Price</th>
            <th className="px-3 py-1.5 text-center">VAT</th>
            <th className="px-2 py-1.5 text-center w-14">К</th>
            <th className="px-3 py-1.5 text-right">Last Edit</th>
            <th className="px-2 py-1.5 text-center w-12">New</th>
            <th className="px-3 py-1.5 text-right">Month</th>
            <th className="px-3 py-1.5 text-right">Year</th>
            <th className="px-3 py-1.5 text-center">Fuel</th>
            <th className="px-3 py-1.5 text-right">KM</th>
            <th className="px-3 py-1.5 text-center w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={16} className="py-16 text-center text-gray-500">No listings found</td>
            </tr>
          )}
          {rows.map((row) => {
            const editing = editingId === row.mobile_id;
            const imageMeta = parseJson<{ cdn: string; shard: string } | null>(row.image_meta, null);
            const thumbKeys = parseJson<string[]>(row.thumb_keys, []);
            const fullKeys = parseJson<string[]>(row.full_keys, []);
            const images = buildImageList(
              row.mobile_id,
              fullKeys.length ? fullKeys : thumbKeys,
              thumbKeys,
              imageMeta,
              row.images_downloaded === 1,
            );
            const thumb = images[0]?.thumb ?? null;

            return (
              <tr key={row.mobile_id} className="group transition-colors hover:bg-gray-800/40">
                {/* Sync indicator */}
                <td className="px-2 py-1 text-center">
                  {row.needs_sync === 1 && (
                    <span className="text-amber-400" title="Needs sync">●</span>
                  )}
                </td>

                {/* Thumbnail */}
                <td className="px-3 py-1">
                  {thumb ? (
                    <div className="relative inline-block w-16">
                      <Link href={`/listings/${row.mobile_id}`} className="peer block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumb} alt="" className="w-16 rounded object-contain" style={{ aspectRatio: '4/3' }} />
                      </Link>
                      <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-64 peer-hover:block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumb} alt="" className="w-full rounded shadow-xl" style={{ aspectRatio: '4/3' }} />
                      </div>
                    </div>
                  ) : (
                    <div className="h-10 w-14 rounded bg-gray-700" />
                  )}
                </td>

                {/* Make + Model */}
                <td className="px-3 py-1">
                  <div className="font-medium text-gray-200">{row.make || '—'}</div>
                  <div className="text-xs text-gray-400">{row.model || '—'}</div>
                </td>

                {/* Title */}
                <td className="max-w-xs px-3 py-1" onClick={() => !editing && startEdit(row)} style={{ cursor: editing ? 'default' : 'pointer' }}>
                  {editing ? (
                    <input
                      value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      disabled={saving}
                      className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                      autoFocus
                    />
                  ) : (
                    <span className="line-clamp-2 text-white">{row.title}</span>
                  )}
                </td>

                {/* Dealer */}
                <td className="px-3 py-1 text-gray-300">{row.dealer_name ?? '—'}</td>

                {/* Ad Status */}
                <td className="px-2 py-1 text-center" onClick={() => !editing && startEdit(row)} style={{ cursor: editing ? 'default' : 'pointer' }}>
                  {editing ? (
                    <select
                      value={editForm.ad_status}
                      onChange={e => setEditForm(f => ({ ...f, ad_status: e.target.value }))}
                      disabled={saving}
                      className="rounded border border-gray-600 bg-gray-800 px-1 py-0.5 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value="none">—</option>
                      <option value="TOP">TOP</option>
                      <option value="VIP">VIP</option>
                    </select>
                  ) : (
                    <AdStatusBadge status={row.ad_status} />
                  )}
                </td>

                {/* Price */}
                <td className="pl-1 pr-3 py-1 text-right" onClick={() => !editing && startEdit(row)} style={{ cursor: editing ? 'default' : 'pointer' }}>
                  {editing ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editForm.current_price}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        setEditForm(f => ({ ...f, current_price: isNaN(v) ? 0 : v }));
                      }}
                      disabled={saving}
                      className="w-28 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-right text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                    />
                  ) : (
                    <span className="font-semibold text-green-400">{formatPrice(row.current_price)}</span>
                  )}
                </td>

                {/* VAT */}
                <td className="px-3 py-1 text-center" onClick={() => !editing && startEdit(row)} style={{ cursor: editing ? 'default' : 'pointer' }}>
                  {editing ? (
                    <select
                      value={editForm.vat}
                      onChange={e => setEditForm(f => ({ ...f, vat: e.target.value }))}
                      disabled={saving}
                      className="rounded border border-gray-600 bg-gray-800 px-1 py-0.5 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">—</option>
                      <option value="included">има</option>
                      <option value="exempt">няма</option>
                      <option value="excluded">+ДДС</option>
                    </select>
                  ) : (
                    <>
                      {row.vat === 'included' && <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[11px] text-blue-200">има</span>}
                      {row.vat === 'exempt' && <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-[11px] text-green-200">няма</span>}
                      {row.vat === 'excluded' && <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">+ДДС</span>}
                      {!row.vat && <span className="text-gray-600">—</span>}
                    </>
                  )}
                </td>

                {/* Kaparo */}
                <td className="px-2 py-1 text-center" onClick={() => !editing && startEdit(row)} style={{ cursor: editing ? 'default' : 'pointer' }}>
                  {editing ? (
                    <select
                      value={editForm.kaparo}
                      onChange={e => setEditForm(f => ({ ...f, kaparo: parseInt(e.target.value, 10) }))}
                      disabled={saving}
                      className="rounded border border-gray-600 bg-gray-800 px-1 py-0.5 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value={0}>—</option>
                      <option value={1}>К</option>
                    </select>
                  ) : (
                    row.kaparo
                      ? <span className="rounded-full bg-orange-900/70 px-2 py-0.5 text-[11px] text-orange-200">К</span>
                      : <span className="text-gray-600">—</span>
                  )}
                </td>

                {/* Last Edit */}
                <td className="px-3 py-1 text-right text-xs text-gray-400">{formatDate(row.last_edit)}</td>

                {/* New */}
                <td className="px-2 py-1 text-center">
                  {row.is_new ? <span className="rounded-full bg-emerald-800/70 px-2 py-0.5 text-[11px] text-emerald-200">new</span> : <span className="text-gray-600">—</span>}
                </td>

                {/* Reg Month */}
                <td className="px-3 py-1 text-right text-gray-300">{row.reg_month ?? '—'}</td>

                {/* Reg Year */}
                <td className="px-3 py-1 text-right text-gray-300">{row.reg_year ?? '—'}</td>

                {/* Fuel */}
                <td className="px-3 py-1 text-center text-xs text-gray-300">{row.fuel ?? '—'}</td>

                {/* Mileage */}
                <td className="px-3 py-1 text-right text-gray-300">{formatMileage(row.mileage)}</td>

                {/* Actions */}
                <td className="px-3 py-1 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {editing ? (
                      <>
                        <button
                          onClick={() => saveEdit(row.mobile_id)}
                          disabled={saving}
                          title="Save"
                          className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          title="Cancel"
                          className="text-gray-400 hover:text-white disabled:opacity-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(row)}
                        disabled={saving}
                        title="Edit"
                        className="text-gray-400 hover:text-blue-400 disabled:pointer-events-none disabled:opacity-30"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/OwnListingsTable.tsx
git commit -m "feat: add OwnListingsTable client component with inline editing"
```

---

## Task 7: Implement the /editown server page

**Files:**
- Modify (replace): `app/editown/page.tsx`

- [ ] **Step 1: Replace the re-export stub**

```tsx
import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import RangeFilter from '@/components/RangeFilter';
import OwnListingsTable from '@/components/OwnListingsTable';
import { getAllDealers, getDistinctFuels, getDistinctYears, getMakeModels, getOwnListings, getPriceChangeRange, getPriceRange } from '@/lib/queries';
import Link from 'next/link';

interface SearchParams {
  make?: string;
  model?: string;
  dealer?: string | string[];
  year?: string | string[];
  status?: string | string[];
  vat?: string | string[];
  fuel?: string | string[];
  kaparo?: string;
  p_min?: string;
  p_max?: string;
  pc_min?: string;
  pc_max?: string;
  sort?: string;
  order?: string;
  search?: string;
  page?: string;
}

function SortLink({
  label,
  sortKey,
  currentSort,
  currentOrder,
  params,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentOrder: string;
  params: URLSearchParams;
}) {
  const p = new URLSearchParams(params.toString());
  p.delete('page');
  if (currentSort === sortKey) {
    p.set('order', currentOrder === 'asc' ? 'desc' : 'asc');
  } else {
    p.set('sort', sortKey);
    p.set('order', 'desc');
  }
  const arrow = currentSort === sortKey ? (currentOrder === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <Link href={`/editown?${p.toString()}`} className="hover:text-white">
      {label}{arrow}
    </Link>
  );
}

export default async function EditOwnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const make = sp.make ?? '';
  const model = sp.model ?? '';
  const dealerSlugs = sp.dealer ? (Array.isArray(sp.dealer) ? sp.dealer : [sp.dealer]) : [];
  const years = sp.year ? (Array.isArray(sp.year) ? sp.year : [sp.year]) : [];
  const statuses = sp.status ? (Array.isArray(sp.status) ? sp.status : [sp.status]) : [];
  const vatValues = sp.vat ? (Array.isArray(sp.vat) ? sp.vat : [sp.vat]) : [];
  const fuels = sp.fuel ? (Array.isArray(sp.fuel) ? sp.fuel : [sp.fuel]) : [];
  const priceMin = sp.p_min !== undefined ? Number(sp.p_min) : null;
  const priceMax = sp.p_max !== undefined ? Number(sp.p_max) : null;
  const priceChangeMin = sp.pc_min !== undefined ? Number(sp.pc_min) : null;
  const priceChangeMax = sp.pc_max !== undefined ? Number(sp.pc_max) : null;
  const kaparo = sp.kaparo ?? '';
  const sort = sp.sort ?? 'last_edit';
  const order = sp.order ?? 'desc';
  const search = sp.search ?? '';
  const page = parseInt(sp.page ?? '1', 10);

  const { data: rows, total } = getOwnListings({
    make, model, dealerSlugs, years, statuses, vatValues, fuels,
    priceMin, priceMax, priceChangeMin, priceChangeMax,
    kaparo, sort, order, search, page, limit: 50,
  });

  const makeModels = getMakeModels();
  const ownDealers = getAllDealers().filter(d => d.own);
  const makes = Object.keys(makeModels).sort();

  const currentParams = new URLSearchParams();
  for (const s of statuses) currentParams.append('status', s);
  for (const v of vatValues) currentParams.append('vat', v);
  for (const f of fuels) currentParams.append('fuel', f);
  if (kaparo) currentParams.set('kaparo', kaparo);
  if (make) currentParams.set('make', make);
  if (model) currentParams.set('model', model);
  for (const d of dealerSlugs) currentParams.append('dealer', d);
  for (const y of years) currentParams.append('year', y);
  if (search) currentParams.set('search', search);
  currentParams.set('sort', sort);
  currentParams.set('order', order);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-3">
          <Suspense>
            <FilterBar
              makes={makes}
              makeModels={makeModels}
              allDealers={ownDealers}
              allYears={getDistinctYears()}
              allFuels={getDistinctFuels()}
              total={total}
              priceChangeRange={getPriceChangeRange()}
              priceRange={getPriceRange()}
              basePath="/editown"
            />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4">
        <OwnListingsTable initialRows={rows} />

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            {page > 1 && (
              <Link
                href={`/editown?${new URLSearchParams({ ...Object.fromEntries(currentParams), page: String(page - 1) }).toString()}`}
                className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
              >
                ← Prev
              </Link>
            )}
            <span className="text-gray-400">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link
                href={`/editown?${new URLSearchParams({ ...Object.fromEntries(currentParams), page: String(page + 1) }).toString()}`}
                className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Verify lint passes**

```bash
npx eslint app/editown/page.tsx components/OwnListingsTable.tsx app/api/listings/
```

Expected: no errors.

- [ ] **Step 4: Verify in the browser**

Open `http://localhost:3000/editown`. Confirm:
- Page loads with the filter bar and own-dealer listings.
- Clicking a row cell enters edit mode (inputs and selects appear).
- Saving a row updates it in place and shows the amber sync dot.
- Filters and sort links navigate to `/editown?...` (not `/listings?...`).
- "Edit Own" link is visible in the filter bar nav area.

Open `http://localhost:3000/listings`. Confirm:
- Filter interactions still navigate to `/listings?...`.
- "Edit Own" link visible and navigates to `/editown`.

- [ ] **Step 5: Commit**

```bash
git add app/editown/page.tsx
git commit -m "feat: implement /editown page with inline listing editing"
```
