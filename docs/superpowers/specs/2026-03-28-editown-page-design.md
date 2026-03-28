# /editown Page Design

**Date:** 2026-03-28
**Status:** Approved

## Purpose

A dedicated page at `/editown` for viewing and inline-editing listings that belong to "own" dealers (`dealers.own = 1`). Identical layout to `/listings` (including filter bar) but scoped to own-dealer inventory, with inline editing on five fields, and a visual indicator for listings that have been locally changed and need to be synced back to mobile.bg.

## Key Concepts

- **`last_edit`** — comes from mobile.bg, reflects the last edit timestamp on their platform. Read-only.
- **`needs_sync`** — a new local flag (`0/1`) set to `1` whenever a listing is edited via `/editown`. Indicates the local change has not yet been pushed back to mobile.bg. Reset to `0` by the future sync process (out of scope here).

## Field types in existing `ListingRow`

Relevant to avoid ambiguity in this spec:
- `vat: string | null` — null means no VAT info
- `ad_status: string` — typed as string (non-null), but DB rows may contain `null`; treat as `"none"` when null
- `current_price: number` — typed as non-nullable number
- `kaparo: number` — `0` or `1`

## Architecture

### 1. DB Schema Change — `db/schema.ts`

Add column to `listings` table:
```ts
needsSync: integer('needs_sync').default(0)
```
`0` = in sync, `1` = locally changed, awaiting sync.

Apply with `npx drizzle-kit push` (this project uses schema push, not migrations — no `out` directory is configured).

### 2. FilterBar — `components/FilterBar.tsx`

Two changes:

**a) Add `basePath: string` prop** (default: `"/listings"`). Replace **every** hardcoded `'/listings?'` in the file with `` `${basePath}?` ``. There are multiple occurrences — in handler functions (`onMakeChange`, `onModelChange`, `onDealerToggle`, `onSearchChange`, `onClearAll`, `onYearToggle`, `onStatusToggle`, `onVatToggle`, `onFuelToggle`) **and** in inline `onClick` callbacks on "Clear" buttons within dropdown JSX. All must be updated.

**b) Add "Edit Own" nav link** in the right-side area alongside the existing Config link. Match the existing style exactly — the Config link is a plain `<a>` tag with `text-sm text-gray-400 hover:text-gray-200 transition-colors`. Add the Edit Own link with the same styling:
```tsx
<a href="/editown" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Edit Own</a>
<a href="/config" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">⚙ Config</a>
```
No icon prefix for Edit Own (the Config link uses `⚙`; don't add a different unicode symbol — just the text label is fine).

Filtering `allDealers` to own-only on `/editown` is safe — `FilterBar` uses `allDealers` only to populate the dealer dropdown options. No other logic depends on the full dealer list.

`app/listings/page.tsx` uses `FilterBar` with no `basePath` (defaults to `"/listings"`) — no change required there.

### 3. RangeFilter — `components/RangeFilter.tsx`

`router.push` lives inside `RangeFilterInner`, not the outer `RangeFilter`. Both need updating:
- Add `basePath: string` (default: `"/listings"`) to outer `Props` and pass it into `<RangeFilterInner basePath={basePath} ...>`.
- Add `basePath: string` to `InnerProps` and use `` `${basePath}?${p.toString()}` `` in the `router.push` call inside `RangeFilterInner`.

`FilterBar` receives `basePath` and passes it down to its `<RangeFilter>` instances.

### 4. Server Page — `app/editown/page.tsx`

**Replace** the existing re-export stub entirely with a new server component.

Structure mirrors `app/listings/page.tsx` with these differences:
- Calls `getOwnListings(...)` instead of `getListings(...)`.
- Default sort: `last_edit` desc (instead of `dealer`).
- Passes `basePath="/editown"` to `FilterBar` and `RangeFilter`.
- `allDealers` passed to `FilterBar` is pre-filtered: `getAllDealers().filter(d => d.own)`.
- Renders `<OwnListingsTable initialRows={rows} />` instead of the inline table JSX.
- The `SortLink` component (defined locally, same as in `app/listings/page.tsx`) uses `` `/editown?${p.toString()}` `` instead of `` `/?${p.toString()}` ``.
- Pagination links use `/editown?` prefix.

### 5. Queries — `lib/queries.ts`

**a) New interface** (after the existing `ListingRow`):
```ts
export interface OwnListingRow extends ListingRow {
  needs_sync: number;
}
```

**b) `getOwnListings(filters: ListingFilters)`** — new function, do not modify `getListings`:
- Same logic as `getListings` but adds `AND d.own = 1` to the WHERE clause.
- Includes `l.needs_sync` in SELECT.
- Returns `{ data: OwnListingRow[]; total: number; page: number; limit: number }` — same shape as `getListings` return value.

**c) `getOwnListingByMobileId(mobileId: string): OwnListingRow | null`** — used by the PATCH route after saving:
- Same JOIN and SELECT as `getOwnListings` (including `l.needs_sync`).
- WHERE: `l.mobile_id = ? AND d.own = 1`.
- Returns the single row or null.

### 6. Client Table — `components/OwnListingsTable.tsx`

New client component.

**Props:**
```ts
interface Props {
  initialRows: OwnListingRow[];
}
```

**State:**
- `rows: OwnListingRow[]` — initialized from `initialRows`.
- `editingId: string | null` — `mobile_id` of the row in edit mode.
- `editForm: { title: string; current_price: number; vat: string; kaparo: number; ad_status: string }`
- `saving: boolean`

**`startEdit(row: OwnListingRow)`** initializes `editForm` as:
```ts
{
  title: row.title ?? '',
  current_price: row.current_price ?? 0,
  vat: row.vat ?? '',            // null → ""
  kaparo: row.kaparo ?? 0,
  ad_status: row.ad_status ?? 'none',  // null → "none"
}
```

**`current_price` input:** `parseInt(e.target.value, 10)`; if `NaN`, clamp to `0`. Save is blocked with `toast.error` if `current_price < 0` (not reachable via the `min="0"` input, but guard in the handler anyway).

**Switching rows:** clicking an editable cell on a different row while one is already editing silently discards uncommitted changes and activates the new row. While `saving = true`, clicking the pencil on any row is a no-op (the pencil icon is disabled / pointer-events-none during save to prevent mid-save row switches).

**Columns:**
| Column | Read view | Edit view |
|---|---|---|
| Sync | amber `●` if `needs_sync = 1`, nothing if `0` | — |
| Img | thumbnail | — |
| Make / Model | text | — |
| Title | text | `<input type="text">` |
| Dealer | text | — |
| Ad Status | badge | `<select>`: `none` (—) / `TOP` / `VIP` |
| Price | formatted integer | `<input type="number" min="0" step="1">` |
| VAT | badge | `<select>`: `""` (—) / `included` / `exempt` / `excluded` |
| Kaparo | badge | `<select>`: `0` (—) / `1` (К) |
| Last Edit | date | — |
| New | badge | — |
| Month / Year | text | — |
| Fuel | text | — |
| KM | text | — |
| Actions | pencil (disabled while saving) | ✓ save / ✗ cancel (both disabled while saving) |

**Save flow:**
1. Click ✓ → set `saving = true`.
2. `PATCH /api/listings/[mobileId]` with body `{ title, current_price, vat, kaparo, ad_status }`. `current_price` sent as number. `vat` sent as `""` for null/unset.
3. On 2xx → parse response as `OwnListingRow` (the route returns the row directly, not wrapped). Update `rows` by replacing the matching row. Exit edit mode. Set `saving = false`.
4. On non-2xx → `(await response.json()).error` → `toast.error(message)`. Stay in edit mode. Set `saving = false`.

**Cancel:** `setEditingId(null)`. Disabled while `saving`.

### 7. API Route — `app/api/listings/[mobileId]/route.ts`

New file. `PATCH` handler only.

**Accepted body fields and validation:**
- `title`: string, non-empty after trim → else `400 { error: "Title is required" }`
- `current_price`: number, integer ≥ 0 → else `400 { error: "Price must be a non-negative integer" }`
- `vat`: one of `""` | `"included"` | `"exempt"` | `"excluded"` → else `400`
- `kaparo`: `0` | `1` → else `400`
- `ad_status`: one of `"none"` | `"TOP"` | `"VIP"` → else `400`

**Steps:**
1. Parse and validate body. → `400 { error: "..." }` on failure.
2. Fetch listing by `mobile_id` using `getOwnListingByMobileId`. → `404 { error: "Not found" }` if null.
3. Update the `listings` row via Drizzle: write all five fields + `needs_sync = 1`. Coerce `vat: ""` → `null`. `ad_status: "none"` is stored as the string `"none"` (not null).
4. Re-fetch via `getOwnListingByMobileId(mobileId)`.
5. Return `200` with the row directly as JSON (not wrapped in an object).
6. Unexpected DB errors → `500 { error: "Internal error" }`.

All non-2xx responses are `{ error: string }`.

## Out of scope

- Triggering sync to mobile.bg (`needs_sync` set here; sync is future work)
- Resetting `needs_sync` to `0`
- Bulk editing, creating, or deleting listings
- Pagination changes (same 50/page as `/listings`)
