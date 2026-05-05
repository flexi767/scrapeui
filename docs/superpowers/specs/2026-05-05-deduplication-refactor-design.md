# Deduplication Refactor — Design Spec

**Date:** 2026-05-05  
**Scope:** Three isolated areas of copy-paste duplication. No new features, no behavioural changes.

---

## Area 1: API Route Auth Helpers

### Problem
`const session = await auth()` is inlined ~38 times across API routes. `requireAdmin()` is independently defined in three files (`app/api/dealers/route.ts`, `app/api/dealers/[id]/route.ts`, `app/api/dealers/test-logins/route.ts`).

### Solution

Create `lib/api/auth-helpers.ts` exporting two helpers:

```ts
export async function requireAuth(): Promise<{ session: Session } | { error: NextResponse }>
export async function requireAdmin(): Promise<{ session: Session } | { error: NextResponse }>
```

`requireAuth` returns 401 if no session. `requireAdmin` returns 401 if no session, 403 if `session.user.role !== 'admin'`.

**Call-site pattern:**
```ts
const check = await requireAuth();
if ('error' in check) return check.error;
// check.session is available here
```

**Files to update:** all API routes that currently inline `const session = await auth()` or define `requireAdmin()` locally. The three files with local `requireAdmin()` definitions are replaced by the shared version; inline auth checks follow the new pattern.

### Constraints
- Do not change any route's authorization logic — only the implementation of the check.
- `requireAdmin` must still return 401 (not 403) when unauthenticated, 403 when authenticated but not admin.

---

## Area 2: Template Filter Bar

### Problem
All 6 `ListingGrid.tsx` templates (`bold`, `executive`, `atlas`, `night`, `sunset`, `pro`) contain identical `<select onChange={filterHref(...)}>` blocks for make, fuel, sort, year range, price, and pagination. The only difference between templates is the CSS class names applied.

### Solution

Create `components/templates/FilterBar.tsx` — a client component:

```tsx
interface FilterBarClasses {
  bar?: string;
  select?: string;
  sortSelect?: string;
  label?: string;
  input?: string;
  pageBtn?: string;
  pageBtnActive?: string;
  pagination?: string;
}

interface FilterBarProps {
  makes: string[];
  filters: PublicListingFilters;
  base: string;
  classes?: FilterBarClasses;
}

export function FilterBar({ makes, filters, base, classes = {} }: FilterBarProps)
```

Renders: make select, fuel select, sort select, year-from/year-to inputs, priceMax input, and pagination links. Each element receives the class from `classes` if provided, falling back to unstyled.

Each `ListingGrid` template replaces its inline filter block with:
```tsx
<FilterBar makes={makes} filters={filters} base={base} classes={{
  bar: s.filterBar,
  select: s.filterSelect,
  sortSelect: s.sortSelect,
  // ...
}} />
```

Pagination uses `Link` from `next/link` (already used inline today).

### Constraints
- Fuel options list is hardcoded in the existing templates; `FilterBar` carries the canonical list.
- Sort options (`newest`, `price_asc`, `price_desc`, `year_desc`) are identical across templates — one canonical list in `FilterBar`.
- Templates that don't use a particular filter (e.g. some omit year range) pass `undefined` for those classes; `FilterBar` always renders all controls, so cosmetic hiding via CSS stays per-template.

---

## Area 3: Scraper Runner Startup Helpers

### Problem
Both `scraper/scripts/run-for-ui.ts` and `scraper/scripts/run-carsbg-for-ui.ts` open the SQLite database and fetch three reference data sets at the top of `main()`. This is copy-pasted with minor variation:

```ts
// Both scripts do:
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const makesMap = await fetchMakesModels().catch(() => null);
const fuelMap = await fetchFuelTypes().catch(() => null);
const transmissionMap = await fetchTransmissionTypes().catch(() => null);
```

### Solution

Add two exports to `scraper/lib/runner.ts`:

```ts
export function openDb(dbPath?: string): Database.Database
```
Creates and returns a `Database` with WAL + foreign_keys pragmas set. `dbPath` defaults to `DB_PATH`.

```ts
export async function fetchRunnerRefData(): Promise<{
  makesMap: MakesMap | null;
  fuelMap: Map<string, string> | null;
  transmissionMap: Map<string, string> | null;
}>
```
Fetches all three reference datasets concurrently (`Promise.all`), returning null for each on failure.

Both scripts call these two helpers at the top of `main()` and remove the inlined equivalents.

**Note:** `run-carsbg-for-ui.ts` additionally calls `loadMobileBgMakesMapFromDb(db)` before falling back to `fetchMakesModels()` — this per-script logic stays in that script.

### Constraints
- Do not merge the two scripts. They have different dealer queries, stats shapes, and scraping logic.
- Only extract what is literally identical: the DB open + pragma block and the three reference-data fetches.

---

## Files Changed Summary

**Create:**
- `lib/api/auth-helpers.ts`
- `components/templates/FilterBar.tsx`

**Modify:**
- `scraper/lib/runner.ts` — add `openDb`, `fetchRunnerRefData`
- All API route files with inline auth (see Area 1)
- `scraper/scripts/run-for-ui.ts` — use `openDb`, `fetchRunnerRefData`
- `scraper/scripts/run-carsbg-for-ui.ts` — use `openDb`, `fetchRunnerRefData`
- All 6 `components/templates/*/ListingGrid.tsx` — use `FilterBar`

**No schema changes, no API contract changes, no visual changes.**
