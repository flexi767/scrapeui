# Deduplication Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate three clusters of copy-paste duplication — API auth boilerplate, template filter controls, and scraper runner startup — without changing any behaviour.

**Architecture:** (1) New `lib/api/auth-helpers.ts` exports `requireAuth`/`requireAdmin` helpers used by all 23 API routes. (2) New `components/templates/FilterBar.tsx` exports atomic filter components (`MakeSelect`, `FuelSelect`, `SortSelect`, `PriceMaxInput`, `YearRangeInputs`, `Pagination`) consumed by all 6 `ListingGrid` templates. (3) `scraper/lib/runner.ts` gains `openDb` and `fetchRunnerRefData` helpers used by both scraper runner scripts.

**Tech Stack:** Next.js 16 App Router, NextAuth v5, better-sqlite3, TypeScript strict, CSS Modules

---

## File Map

**Create:**
- `lib/api/auth-helpers.ts` — `requireAuth()` and `requireAdmin()` helpers
- `components/templates/FilterBar.tsx` — atomic filter + pagination components

**Modify:**
- `scraper/lib/runner.ts` — add `openDb`, `fetchRunnerRefData`
- `scraper/scripts/run-for-ui.ts` — use `openDb`, `fetchRunnerRefData`
- `scraper/scripts/run-carsbg-for-ui.ts` — use `openDb`, `fetchRunnerRefData`
- `app/api/dealers/route.ts` — use `requireAdmin`
- `app/api/dealers/[id]/route.ts` — use `requireAdmin`
- `app/api/dealers/test-logins/route.ts` — use `requireAdmin`
- `app/api/dealer-templates/route.ts` — use `requireAuth`
- `app/api/dealer-templates/[id]/route.ts` — use `requireAuth`
- `app/api/dealer-templates/[id]/fork/route.ts` — use `requireAuth`
- `app/api/dealer-templates/[id]/activate/route.ts` — use `requireAuth`
- `app/api/dealer-templates/[id]/delete/route.ts` — use `requireAuth`
- `app/api/dealer-templates/[id]/save-page/route.ts` — use `requireAuth`
- `app/api/tasks/route.ts` — use `requireAuth`
- `app/api/tasks/[id]/route.ts` — use `requireAuth`
- `app/api/tasks/[id]/comments/route.ts` — use `requireAuth`
- `app/api/tasks/[id]/time/route.ts` — use `requireAuth`
- `app/api/expenses/route.ts` — use `requireAuth`
- `app/api/expenses/[id]/route.ts` — use `requireAuth`
- `app/api/articles/route.ts` — use `requireAuth`
- `app/api/articles/[id]/route.ts` — use `requireAuth`
- `app/api/labels/route.ts` — use `requireAuth`
- `app/api/labels/[id]/route.ts` — use `requireAuth`
- `app/api/uploads/route.ts` — use `requireAuth`
- `app/api/search/route.ts` — use `requireAuth`
- `app/api/users/route.ts` — use `requireAuth`
- `app/api/notifications/route.ts` — use `requireAuth`
- `components/templates/bold/ListingGrid.tsx` — use FilterBar components
- `components/templates/atlas/ListingGrid.tsx` — use FilterBar components
- `components/templates/executive/ListingGrid.tsx` — use FilterBar components
- `components/templates/night/ListingGrid.tsx` — use FilterBar components
- `components/templates/pro/ListingGrid.tsx` — use FilterBar components
- `components/templates/sunset/ListingGrid.tsx` — use FilterBar components

---

## Task 1: API Auth Helpers

### Step 1.1: Create `lib/api/auth-helpers.ts`

- [ ] Create `lib/api/auth-helpers.ts`:

```typescript
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

type AuthOk = { session: Session };
type AuthErr = { error: NextResponse };

export async function requireAuth(): Promise<AuthOk | AuthErr> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session: session as Session };
}

export async function requireAdmin(): Promise<AuthOk | AuthErr> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session: session as Session };
}
```

### Step 1.2: Update dealer routes (use `requireAdmin`)

- [ ] Read and update `app/api/dealers/route.ts`:

Replace the local `requireAdmin` definition and its two call sites:

```typescript
// Remove: the local async function requireAdmin() { ... } definition
// Add import at top:
import { requireAdmin } from '@/lib/api/auth-helpers';

// Replace each handler's auth block. Example for GET:
export async function GET() {
  const check = await requireAdmin();
  if ('error' in check) return check.error;
  // ... rest unchanged
}
```

Apply the same pattern to every handler in the file (GET, POST, etc.).

- [ ] Read and update `app/api/dealers/[id]/route.ts`:

Remove the local `requireAdmin` function. Add the import. Replace call sites:
```typescript
import { requireAdmin } from '@/lib/api/auth-helpers';

export async function PATCH(req: NextRequest, { params }: ...) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;
  // rest unchanged
}

export async function DELETE(_req: NextRequest, { params }: ...) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;
  // rest unchanged
}
```

- [ ] Read and update `app/api/dealers/test-logins/route.ts`:

Remove the local `requireAdmin` function. Add import. Replace call site.

### Step 1.3: Update dealer-template routes (use `requireAuth`)

Each of these files has `const session = await auth(); if (!session) return Response.json(...)`. Replace with the shared helper.

- [ ] Update `app/api/dealer-templates/route.ts`:

```typescript
// Remove: import { auth } from '@/lib/auth';
// Add:
import { requireAuth } from '@/lib/api/auth-helpers';

// Replace each handler's auth block, e.g.:
export async function GET() {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  // rest unchanged — if the handler used `session`, access it via check.session
}
```

- [ ] Update `app/api/dealer-templates/[id]/route.ts` — same pattern.
- [ ] Update `app/api/dealer-templates/[id]/fork/route.ts` — same pattern.
- [ ] Update `app/api/dealer-templates/[id]/activate/route.ts` — same pattern.
- [ ] Update `app/api/dealer-templates/[id]/delete/route.ts` — same pattern.
- [ ] Update `app/api/dealer-templates/[id]/save-page/route.ts` — same pattern.

### Step 1.4: Update remaining routes (use `requireAuth`)

Each file has `const session = await auth(); if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`. Replace with the shared helper.

- [ ] Update `app/api/tasks/route.ts`:

```typescript
// Remove: import { auth } from '@/lib/auth'; (if only used for auth)
// Add:
import { requireAuth } from '@/lib/api/auth-helpers';

export async function GET(request: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;
  // rest unchanged
}

export async function POST(request: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;
  // rest unchanged — session.user.id etc. still available
}
```

- [ ] Update `app/api/tasks/[id]/route.ts` — same pattern.
- [ ] Update `app/api/tasks/[id]/comments/route.ts` — same pattern.
- [ ] Update `app/api/tasks/[id]/time/route.ts` — same pattern.
- [ ] Update `app/api/expenses/route.ts` — same pattern.
- [ ] Update `app/api/expenses/[id]/route.ts` — same pattern.
- [ ] Update `app/api/articles/route.ts` — same pattern.
- [ ] Update `app/api/articles/[id]/route.ts` — same pattern.
- [ ] Update `app/api/labels/route.ts` — same pattern.
- [ ] Update `app/api/labels/[id]/route.ts` — same pattern.
- [ ] Update `app/api/uploads/route.ts` — same pattern.
- [ ] Update `app/api/search/route.ts` — same pattern.
- [ ] Update `app/api/users/route.ts` — same pattern.
- [ ] Update `app/api/notifications/route.ts` — same pattern.

### Step 1.5: TypeScript check

- [ ] Run:
```bash
npx tsc --noEmit
```
Expected: 0 errors. Fix any type errors before continuing.

### Step 1.6: Commit

- [ ] Run:
```bash
git add lib/api/auth-helpers.ts app/api/
git commit -m "refactor: extract requireAuth/requireAdmin to lib/api/auth-helpers"
```

---

## Task 2: Template Filter Components

### Step 2.1: Create `components/templates/FilterBar.tsx`

- [ ] Create `components/templates/FilterBar.tsx`:

```typescript
"use client";

import Link from "next/link";
import type { PublicListingFilters } from "./types";
import { filterHref } from "./utils";

export function MakeSelect({ base, filters, makes, className, allLabel = "All Makes" }: {
  base: string;
  filters: PublicListingFilters;
  makes: string[];
  className?: string;
  allLabel?: string;
}) {
  return (
    <select
      className={className}
      defaultValue={filters.make ?? ""}
      onChange={(e) => { window.location.href = filterHref(base, filters, { make: e.target.value, page: 1 }); }}
    >
      <option value="">{allLabel}</option>
      {makes.map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
  );
}

export function FuelSelect({ base, filters, className, allLabel = "Any Fuel" }: {
  base: string;
  filters: PublicListingFilters;
  className?: string;
  allLabel?: string;
}) {
  return (
    <select
      className={className}
      defaultValue={filters.fuel ?? ""}
      onChange={(e) => { window.location.href = filterHref(base, filters, { fuel: e.target.value, page: 1 }); }}
    >
      <option value="">{allLabel}</option>
      <option value="Бензин">Petrol</option>
      <option value="Дизел">Diesel</option>
      <option value="Електрически">Electric</option>
      <option value="Хибрид">Hybrid</option>
    </select>
  );
}

export function SortSelect({ base, filters, className, includeMileage = false, includeYear = true }: {
  base: string;
  filters: PublicListingFilters;
  className?: string;
  includeMileage?: boolean;
  includeYear?: boolean;
}) {
  return (
    <select
      className={className}
      defaultValue={filters.sort ?? "newest"}
      onChange={(e) => { window.location.href = filterHref(base, filters, { sort: e.target.value, page: 1 }); }}
    >
      <option value="newest">Newest First</option>
      <option value="price_asc">Price ↑</option>
      <option value="price_desc">Price ↓</option>
      {includeMileage && <option value="mileage_asc">Mileage ↑</option>}
      {includeYear && <option value="year_desc">Year ↓</option>}
    </select>
  );
}

export function PriceMaxInput({ base, filters, className }: {
  base: string;
  filters: PublicListingFilters;
  className?: string;
}) {
  return (
    <input
      className={className}
      placeholder="e.g. 50000"
      defaultValue={filters.priceMax ?? ""}
      onBlur={(e) => {
        if (e.target.value) window.location.href = filterHref(base, filters, { priceMax: Number(e.target.value), page: 1 });
      }}
    />
  );
}

export function YearRangeInputs({ base, filters, inputClassName, rowClassName }: {
  base: string;
  filters: PublicListingFilters;
  inputClassName?: string;
  rowClassName?: string;
}) {
  return (
    <div className={rowClassName}>
      <input
        className={inputClassName}
        placeholder="From"
        defaultValue={filters.yearFrom ?? ""}
        onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { yearFrom: e.target.value, page: 1 }); }}
      />
      <input
        className={inputClassName}
        placeholder="To"
        defaultValue={filters.yearTo ?? ""}
        onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { yearTo: e.target.value, page: 1 }); }}
      />
    </div>
  );
}

export function Pagination({ page, totalPages, base, filters, wrapperClassName, btnClassName, btnActiveClassName, showArrows = true }: {
  page: number;
  totalPages: number;
  base: string;
  filters: PublicListingFilters;
  wrapperClassName?: string;
  btnClassName?: string;
  btnActiveClassName?: string;
  showArrows?: boolean;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1);
  return (
    <div className={wrapperClassName}>
      {showArrows && page > 1 && (
        <Link href={filterHref(base, filters, { page: page - 1 })} className={btnClassName}>←</Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={filterHref(base, filters, { page: p })}
          className={[btnClassName, p === page ? btnActiveClassName : undefined].filter(Boolean).join(" ") || undefined}
        >
          {p}
        </Link>
      ))}
      {showArrows && page < totalPages && (
        <Link href={filterHref(base, filters, { page: page + 1 })} className={btnClassName}>→</Link>
      )}
    </div>
  );
}
```

### Step 2.2: Update `components/templates/bold/ListingGrid.tsx`

Bold uses: sidebar with labeled groups, make+fuel+sort selects, year range inputs, price max input, sort select, pagination.

- [ ] Add import at top of file:
```typescript
import { MakeSelect, FuelSelect, SortSelect, PriceMaxInput, YearRangeInputs, Pagination } from "../FilterBar";
```

- [ ] Replace the make select block (inside `<div className={s.filterGroup}>` with label "Make") with:
```tsx
<div className={s.filterGroup}>
  <label className={s.filterLabel}>Make</label>
  <MakeSelect base={base} filters={filters} makes={makes} className={s.filterSelect} />
</div>
```

- [ ] Replace the fuel select block (filter group "Fuel") with:
```tsx
<div className={s.filterGroup}>
  <label className={s.filterLabel}>Fuel</label>
  <FuelSelect base={base} filters={filters} className={s.filterSelect} allLabel="Any" />
</div>
```

- [ ] Replace the year range block (filter group "Year") with:
```tsx
<div className={s.filterGroup}>
  <label className={s.filterLabel}>Year</label>
  <YearRangeInputs base={base} filters={filters} inputClassName={s.filterInput} rowClassName={s.rangeRow} />
</div>
```

- [ ] Replace the max price block (filter group "Max Price") with:
```tsx
<div className={s.filterGroup}>
  <label className={s.filterLabel}>Max Price (лв)</label>
  <PriceMaxInput base={base} filters={filters} className={s.filterInput} />
</div>
```

- [ ] Replace the sort select with:
```tsx
<SortSelect base={base} filters={filters} className={s.sortSelect} includeMileage />
```

- [ ] Replace the pagination block with:
```tsx
<Pagination
  page={page} totalPages={totalPages} base={base} filters={filters}
  wrapperClassName={s.pagination} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
/>
```

- [ ] Remove the `filterHref` import from `../utils` if it's no longer used directly in the file (keep `fmtPrice`, `fmtMileage`).

### Step 2.3: Update `components/templates/atlas/ListingGrid.tsx`

Atlas uses: bare selects (no class), make+fuel+sort, pagination.

- [ ] Add import:
```typescript
import { MakeSelect, FuelSelect, SortSelect, Pagination } from "../FilterBar";
```

- [ ] Replace the make `<select>` inside `<div className={s.filterBar}>` with:
```tsx
<MakeSelect base={base} filters={filters} makes={makes} />
```

- [ ] Replace the fuel `<select>` with:
```tsx
<FuelSelect base={base} filters={filters} allLabel="Any Fuel" />
```

- [ ] Replace the sort `<select>` with:
```tsx
<SortSelect base={base} filters={filters} />
```

- [ ] Replace the pagination block with:
```tsx
<Pagination
  page={page} totalPages={totalPages} base={base} filters={filters}
  wrapperClassName={s.pagination} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
/>
```

- [ ] Remove `filterHref` from the `../utils` import if no longer used directly.

### Step 2.4: Update `components/templates/executive/ListingGrid.tsx`

Executive uses: make+fuel+sort selects in the header (no year, no price), pagination without arrows.

- [ ] Add import:
```typescript
import { MakeSelect, FuelSelect, SortSelect, Pagination } from "../FilterBar";
```

- [ ] Replace the make select (inside `<div className={s.headerFilters}>`) with:
```tsx
<MakeSelect base={base} filters={filters} makes={makes} className={s.filterSelect} />
```

- [ ] Replace the fuel select with:
```tsx
<FuelSelect base={base} filters={filters} className={s.filterSelect} allLabel="All Fuels" />
```

- [ ] Replace the sort select with:
```tsx
<SortSelect base={base} filters={filters} className={s.sortSelect} includeYear={false} />
```

- [ ] Replace the pagination block with:
```tsx
<Pagination
  page={page} totalPages={totalPages} base={base} filters={filters}
  wrapperClassName={s.pagination} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
  showArrows={false}
/>
```

- [ ] Remove `filterHref` from the `../utils` import if no longer used directly.

### Step 2.5: Update `components/templates/night/ListingGrid.tsx`

Night uses: sidebar with labeled groups, make+fuel selects, price max input, sort select (with mileage), pagination.

- [ ] Add import:
```typescript
import { MakeSelect, FuelSelect, SortSelect, PriceMaxInput, Pagination } from "../FilterBar";
```

- [ ] Replace the make select (inside `<div className={s.filterGroup}>` with label "Make") with:
```tsx
<div className={s.filterGroup}>
  <label className={s.filterLabel}>Make</label>
  <MakeSelect base={base} filters={filters} makes={makes} className={s.filterSelect} allLabel="All" />
</div>
```

- [ ] Replace the fuel select block (filter group "Fuel") with:
```tsx
<div className={s.filterGroup}>
  <label className={s.filterLabel}>Fuel</label>
  <FuelSelect base={base} filters={filters} className={s.filterSelect} allLabel="Any" />
</div>
```

- [ ] Replace the max price block (filter group "Max Price") with:
```tsx
<div className={s.filterGroup}>
  <label className={s.filterLabel}>Max Price</label>
  <PriceMaxInput base={base} filters={filters} className={s.filterInput} />
</div>
```

- [ ] Replace the sort select with:
```tsx
<SortSelect base={base} filters={filters} className={s.sortSelect} includeMileage />
```

- [ ] Replace the pagination block with:
```tsx
<Pagination
  page={page} totalPages={totalPages} base={base} filters={filters}
  wrapperClassName={s.pagination} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
/>
```

- [ ] Remove `filterHref` from the `../utils` import if no longer used directly.

### Step 2.6: Update `components/templates/pro/ListingGrid.tsx`

Pro uses: toolbar with make+fuel+sort selects AND sidebar with another make select + price max input + single year-from input. Pagination has an extra inner `pageBtns` wrapper and a `pageInfo` line. Keep the `pageInfo` line inline; use `Pagination` for the button set.

- [ ] Add import:
```typescript
import { MakeSelect, FuelSelect, SortSelect, PriceMaxInput, Pagination } from "../FilterBar";
```

- [ ] In the toolbar section, replace the make select with:
```tsx
<MakeSelect base={base} filters={filters} makes={makes} className={s.toolbarSelect} />
```

- [ ] Replace the toolbar fuel select with:
```tsx
<FuelSelect base={base} filters={filters} className={s.toolbarSelect} allLabel="Any Fuel" />
```

- [ ] Replace the toolbar sort select with:
```tsx
<SortSelect base={base} filters={filters} className={s.toolbarSelect} includeMileage />
```

- [ ] In the sidebar, replace the make select (with class `sbSelect`) with:
```tsx
<MakeSelect base={base} filters={filters} makes={makes} className={s.sbSelect} allLabel="All" />
```

- [ ] Replace the price max input (class `sbInput`) with:
```tsx
<PriceMaxInput base={base} filters={filters} className={s.sbInput} />
```

- [ ] The sidebar's single year-from input is unique to pro — leave it inline (it is a single input, not a range).

- [ ] Replace the pagination block:

The current code is:
```tsx
{totalPages > 1 && (
  <div className={s.pagination}>
    <div className={s.pageInfo}>Showing {startItem}–{endItem} of {total} vehicles</div>
    <div className={s.pageBtns}>
      {page > 1 && <Link ...>←</Link>}
      {Array.from(...).map((p) => <Link ...>{p}</Link>)}
      {page < totalPages && <Link ...>→</Link>}
    </div>
  </div>
)}
```

Replace with:
```tsx
{totalPages > 1 && (
  <div className={s.pagination}>
    <div className={s.pageInfo}>Showing {startItem}–{endItem} of {total} vehicles</div>
    <Pagination
      page={page} totalPages={totalPages} base={base} filters={filters}
      wrapperClassName={s.pageBtns} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
    />
  </div>
)}
```

- [ ] Remove `filterHref` from the `../utils` import if no longer used directly. Remove unused `Link` import if no longer used.

### Step 2.7: Update `components/templates/sunset/ListingGrid.tsx`

Sunset uses: horizontal strip with make+fuel+sort selects, pagination.

- [ ] Add import:
```typescript
import { MakeSelect, FuelSelect, SortSelect, Pagination } from "../FilterBar";
```

- [ ] Replace the make select (inside `<div className={s.searchStrip}>`) with:
```tsx
<MakeSelect base={base} filters={filters} makes={makes} className={s.searchSelect} />
```

- [ ] Replace the fuel select with:
```tsx
<FuelSelect base={base} filters={filters} className={s.searchSelect} allLabel="Any Fuel" />
```

- [ ] Replace the sort select with:
```tsx
<SortSelect base={base} filters={filters} className={s.searchSelect} />
```

- [ ] Replace the pagination block with:
```tsx
<Pagination
  page={page} totalPages={totalPages} base={base} filters={filters}
  wrapperClassName={s.pagination} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
/>
```

- [ ] Remove `filterHref` from `../utils` import if no longer used directly.

### Step 2.8: TypeScript check

- [ ] Run:
```bash
npx tsc --noEmit
```
Expected: 0 errors.

### Step 2.9: Commit

- [ ] Run:
```bash
git add components/templates/
git commit -m "refactor: extract template filter controls into shared FilterBar components"
```

---

## Task 3: Scraper Runner Startup Helpers

### Step 3.1: Add `openDb` and `fetchRunnerRefData` to `scraper/lib/runner.ts`

- [ ] Read `scraper/lib/runner.ts` to see the current exports, then add at the bottom:

```typescript
import Database from "better-sqlite3";
import { fetchMakesModels, type MakesMap } from "@/lib/mobile-bg/makes-models";
import { fetchFuelTypes } from "@/lib/mobile-bg/fuel-types";
import { fetchTransmissionTypes } from "@/lib/mobile-bg/transmission-types";

export function openDb(dbPath?: string): Database.Database {
  const db = new Database(dbPath ?? DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export async function fetchRunnerRefData(overrides: { makesMap?: MakesMap | null } = {}): Promise<{
  makesMap: MakesMap | null;
  fuelMap: Map<string, string> | null;
  transmissionMap: Map<string, string> | null;
}> {
  const [makesMap, fuelMap, transmissionMap] = await Promise.all([
    overrides.makesMap !== undefined
      ? Promise.resolve(overrides.makesMap)
      : fetchMakesModels().catch(() => null),
    fetchFuelTypes().catch(() => null),
    fetchTransmissionTypes().catch(() => null),
  ]);
  return { makesMap, fuelMap, transmissionMap };
}
```

### Step 3.2: Update `scraper/scripts/run-for-ui.ts`

- [ ] Add `openDb` and `fetchRunnerRefData` to the import from `@/scraper/lib/runner`:

```typescript
import { emit, formatError, parseRunnerArgs, DB_PATH, openDb, fetchRunnerRefData } from "@/scraper/lib/runner";
```

- [ ] In `main()`, replace the database-open + pragma block and the three reference-data fetches:

Replace:
```typescript
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
const makesMap = await fetchMakesModels().catch(() => null);
const fuelMap = await fetchFuelTypes().catch(() => null);
const transmissionMap = await fetchTransmissionTypes().catch(() => null);
```

With:
```typescript
const db = openDb();
const { makesMap, fuelMap, transmissionMap } = await fetchRunnerRefData();
```

- [ ] Remove the now-unused imports (if `fetchMakesModels`, `fetchFuelTypes`, `fetchTransmissionTypes`, and `Database` are no longer used elsewhere in the file). Check with grep before removing. Do not remove them if used elsewhere in the file.

### Step 3.3: Update `scraper/scripts/run-carsbg-for-ui.ts`

- [ ] Add `openDb` and `fetchRunnerRefData` to the import from `@/scraper/lib/runner`:

```typescript
import { emit, formatError, parseRunnerArgs, DB_PATH, openDb, fetchRunnerRefData } from '@/scraper/lib/runner';
```

- [ ] In `main()`, replace the database-open + pragma block and the three reference-data fetches:

Replace:
```typescript
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const makesMap = loadMobileBgMakesMapFromDb(db) ?? await fetchMakesModels().catch(() => null);
const fuelMap = await fetchFuelTypes().catch(() => null);
const transmissionMap = await fetchTransmissionTypes().catch(() => null);
```

With:
```typescript
const db = openDb();
const dbMakesMap = loadMobileBgMakesMapFromDb(db);
const { makesMap, fuelMap, transmissionMap } = await fetchRunnerRefData(
  dbMakesMap ? { makesMap: dbMakesMap } : {}
);
```

- [ ] Remove the now-unused imports (`Database`, `fetchMakesModels`, `fetchFuelTypes`, `fetchTransmissionTypes`) if they are no longer used elsewhere in the file. Check with grep before removing.

### Step 3.4: TypeScript check

- [ ] Run:
```bash
npx tsc --noEmit
```
Expected: 0 errors.

### Step 3.5: Commit

- [ ] Run:
```bash
git add scraper/lib/runner.ts scraper/scripts/run-for-ui.ts scraper/scripts/run-carsbg-for-ui.ts
git commit -m "refactor: extract openDb and fetchRunnerRefData to scraper/lib/runner"
```

---

## Task 4: Final Verification

- [ ] Run full TypeScript check:
```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] Run lint:
```bash
npm run lint
```
Expected: 0 errors (1 pre-existing warning in SearchPrefillFields.tsx is acceptable).

- [ ] Run build:
```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds, no errors.

- [ ] Commit if any lint fixes were needed:
```bash
git add -A
git commit -m "refactor: deduplication — api auth helpers, template filters, scraper startup"
```
