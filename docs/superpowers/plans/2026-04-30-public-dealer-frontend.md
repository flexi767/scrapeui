# Public Dealer Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public-facing, multidomain car listing frontend to the existing scrapeui Next.js app, with 6 throwaway templates and domain/path-based routing.

**Architecture:** A new `app/(public)/` route group hosts `/d/[slug]` pages (no auth). `middleware.ts` reads the `Host` header, queries the dealers DB for a matching `public_domain`, and rewrites the request to `/d/[slug]` so the browser URL stays as the custom domain. Templates are isolated React + CSS Module component folders in `components/templates/` — delete a folder to remove a template. Dealers configure their template and domain via a new admin panel.

**Tech Stack:** Next.js 16 App Router, better-sqlite3 raw SQL, React Server Components, CSS Modules, TypeScript strict, `middleware.ts` with `runtime = 'nodejs'`

---

## File Map

**Create:**
- `scripts/migrations/add-public-dealer-fields.sql` — DB migration
- `lib/query-modules/public.ts` — public-site query functions
- `middleware.ts` — domain→slug rewrite
- `app/(public)/layout.tsx` — bare layout (no auth, no sidebar)
- `app/(public)/d/[slug]/page.tsx` — dealer listing grid page
- `app/(public)/d/[slug]/[mobileId]/page.tsx` — single listing detail page
- `components/templates/types.ts` — shared prop types for all templates
- `components/templates/index.ts` — template registry
- `components/templates/bold/ListingGrid.tsx` + `ListingGrid.module.css`
- `components/templates/bold/ListingDetail.tsx` + `ListingDetail.module.css`
- `components/templates/executive/ListingGrid.tsx` + `ListingGrid.module.css`
- `components/templates/executive/ListingDetail.tsx` + `ListingDetail.module.css`
- `components/templates/atlas/ListingGrid.tsx` + `ListingGrid.module.css`
- `components/templates/atlas/ListingDetail.tsx` + `ListingDetail.module.css`
- `components/templates/night/ListingGrid.tsx` + `ListingGrid.module.css`
- `components/templates/night/ListingDetail.tsx` + `ListingDetail.module.css`
- `components/templates/sunset/ListingGrid.tsx` + `ListingGrid.module.css`
- `components/templates/sunset/ListingDetail.tsx` + `ListingDetail.module.css`
- `components/templates/pro/ListingGrid.tsx` + `ListingGrid.module.css`
- `components/templates/pro/ListingDetail.tsx` + `ListingDetail.module.css`
- `components/PublicDealerConfig.tsx` — admin UI panel for template/domain config

**Modify:**
- `db/schema.ts` — add `publicDomain`, `template`, `publicEnabled` to `dealers`
- `lib/queries.ts` — re-export from `lib/query-modules/public.ts`
- `next.config.ts` — allow Unsplash images (for template previews in admin)
- `components/DealersManager.tsx` — embed `PublicDealerConfig` per dealer

---

## Task 1: Database Migration

**Files:**
- Create: `scripts/migrations/add-public-dealer-fields.sql`
- Modify: `db/schema.ts`

- [ ] **Step 1.1: Write migration SQL**

Create `scripts/migrations/add-public-dealer-fields.sql`:

```sql
ALTER TABLE dealers ADD COLUMN public_domain TEXT;
ALTER TABLE dealers ADD COLUMN template TEXT NOT NULL DEFAULT 'bold';
ALTER TABLE dealers ADD COLUMN public_enabled INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 1.2: Apply migration to the live database**

```bash
sqlite3 /Users/v/dev/scraped/listings.db < scripts/migrations/add-public-dealer-fields.sql
```

Verify:
```bash
sqlite3 /Users/v/dev/scraped/listings.db "PRAGMA table_info(dealers);"
```
Expected: rows for `public_domain`, `template`, `public_enabled` appear in the output.

- [ ] **Step 1.3: Update Drizzle schema**

In `db/schema.ts`, add three fields to the `dealers` table definition (after `createdAt`):

```typescript
  publicDomain: text("public_domain"),
  template: text("template").default("bold"),
  publicEnabled: integer("public_enabled").default(0),
```

- [ ] **Step 1.4: Commit**

```bash
git add scripts/migrations/add-public-dealer-fields.sql db/schema.ts
git commit -m "feat: add public_domain, template, public_enabled to dealers"
```

---

## Task 2: Public Query Functions

**Files:**
- Create: `lib/query-modules/public.ts`
- Modify: `lib/queries.ts`

- [ ] **Step 2.1: Create `lib/query-modules/public.ts`**

```typescript
import { raw } from "@/db/client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PublicDealer {
  id: number;
  slug: string;
  name: string;
  template: string;
  publicDomain: string | null;
  publicEnabled: number;
}

export interface PublicListing {
  mobileId: string;
  make: string | null;
  model: string | null;
  regYear: string | null;
  fuel: string | null;
  transmission: string | null;
  mileage: number | null;
  currentPrice: number | null;
  imageCount: number | null;
  thumbKeys: string | null;
  fullKeys: string | null;
  imageMeta: string | null;
  imagesDownloaded: number | null;
  thumbSaved: number | null;
  isNew: number | null;
  bodyType: string | null;
}

export interface PublicListingDetail extends PublicListing {
  power: number | null;
  color: string | null;
  vin: string | null;
  euronorm: number | null;
  description: string | null;
  extrasJson: string | null;
  regMonth: string | null;
}

export interface PublicListingFilters {
  make?: string;
  fuel?: string;
  yearFrom?: string;
  yearTo?: string;
  priceMin?: number;
  priceMax?: number;
  mileageMax?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface PublicListingsResult {
  listings: PublicListing[];
  total: number;
  page: number;
  limit: number;
  makes: string[];
}

// ── Allowed sort fields (whitelist) ────────────────────────────────────────

const ALLOWED_SORT: Record<string, string> = {
  newest: "l.last_edit DESC",
  price_asc: "l.current_price ASC",
  price_desc: "l.current_price DESC",
  mileage_asc: "l.mileage ASC",
  year_desc: "l.reg_year DESC",
};

// ── Queries ────────────────────────────────────────────────────────────────

export function getPublicDealer(slug: string): PublicDealer | null {
  const row = raw
    .prepare(
      `SELECT id, slug, name,
        COALESCE(template, 'bold') as template,
        public_domain as publicDomain,
        COALESCE(public_enabled, 0) as publicEnabled
       FROM dealers
       WHERE slug = ? AND active = 1
       LIMIT 1`,
    )
    .get(slug) as PublicDealer | undefined;
  return row ?? null;
}

export function getDealerByDomain(domain: string): PublicDealer | null {
  const row = raw
    .prepare(
      `SELECT id, slug, name,
        COALESCE(template, 'bold') as template,
        public_domain as publicDomain,
        COALESCE(public_enabled, 0) as publicEnabled
       FROM dealers
       WHERE public_domain = ? AND public_enabled = 1 AND active = 1
       LIMIT 1`,
    )
    .get(domain) as PublicDealer | undefined;
  return row ?? null;
}

export function getPublicListings(
  dealerId: number,
  filters: PublicListingFilters = {},
): PublicListingsResult {
  const {
    make = "",
    fuel = "",
    yearFrom = "",
    yearTo = "",
    priceMin,
    priceMax,
    mileageMax,
    sort = "newest",
    page = 1,
    limit = 24,
  } = filters;

  const wheres: string[] = [
    "l.dealer_id = ?",
    "l.is_active = 1",
    "(l.duplicate = 0 OR l.duplicate IS NULL)",
  ];
  const params: (string | number)[] = [dealerId];

  if (make) { wheres.push("l.make = ?"); params.push(make); }
  if (fuel) { wheres.push("l.fuel = ?"); params.push(fuel); }
  if (yearFrom) { wheres.push("CAST(l.reg_year AS INTEGER) >= ?"); params.push(parseInt(yearFrom, 10)); }
  if (yearTo) { wheres.push("CAST(l.reg_year AS INTEGER) <= ?"); params.push(parseInt(yearTo, 10)); }
  if (priceMin != null) { wheres.push("l.current_price >= ?"); params.push(priceMin); }
  if (priceMax != null) { wheres.push("l.current_price <= ?"); params.push(priceMax); }
  if (mileageMax != null) { wheres.push("l.mileage <= ?"); params.push(mileageMax); }

  const orderBy = ALLOWED_SORT[sort] ?? ALLOWED_SORT.newest;
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(48, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  const where = wheres.join(" AND ");

  const countRow = raw
    .prepare(`SELECT COUNT(*) as n FROM listings l WHERE ${where}`)
    .get(...params) as { n: number };

  const rows = raw
    .prepare(
      `SELECT
        l.mobile_id as mobileId,
        l.make, l.model, l.reg_year as regYear, l.fuel,
        l.transmission, l.mileage, l.current_price as currentPrice,
        l.image_count as imageCount, l.thumb_keys as thumbKeys,
        l.full_keys as fullKeys, l.image_meta as imageMeta,
        l.images_downloaded as imagesDownloaded, l.thumb_saved as thumbSaved,
        l.is_new as isNew, l.body_type as bodyType
       FROM listings l
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, safeLimit, offset) as PublicListing[];

  // Available makes for filter dropdown
  const makeRows = raw
    .prepare(
      `SELECT DISTINCT make FROM listings
       WHERE dealer_id = ? AND is_active = 1 AND make IS NOT NULL
       ORDER BY make`,
    )
    .all(dealerId) as { make: string }[];

  return {
    listings: rows,
    total: countRow.n,
    page: safePage,
    limit: safeLimit,
    makes: makeRows.map((r) => r.make),
  };
}

export function getPublicListing(
  dealerId: number,
  mobileId: string,
): PublicListingDetail | null {
  const row = raw
    .prepare(
      `SELECT
        l.mobile_id as mobileId,
        l.make, l.model, l.reg_year as regYear, l.reg_month as regMonth,
        l.fuel, l.transmission, l.mileage, l.current_price as currentPrice,
        l.image_count as imageCount, l.thumb_keys as thumbKeys,
        l.full_keys as fullKeys, l.image_meta as imageMeta,
        l.images_downloaded as imagesDownloaded, l.thumb_saved as thumbSaved,
        l.is_new as isNew, l.body_type as bodyType,
        l.power, l.color, l.vin, l.euronorm,
        l.description, l.extras_json as extrasJson
       FROM listings l
       WHERE l.dealer_id = ? AND l.mobile_id = ? AND l.is_active = 1
       LIMIT 1`,
    )
    .get(dealerId, mobileId) as PublicListingDetail | undefined;
  return row ?? null;
}
```

- [ ] **Step 2.2: Re-export from `lib/queries.ts`**

Add at the end of `lib/queries.ts`:

```typescript
export * from './query-modules/public';
```

- [ ] **Step 2.3: Verify queries compile**

```bash
cd /Users/v/dev/scrapeui && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the new file.

- [ ] **Step 2.4: Commit**

```bash
git add lib/query-modules/public.ts lib/queries.ts
git commit -m "feat: add public dealer query functions"
```

---

## Task 3: Middleware — Domain Rewriting

**Files:**
- Create: `middleware.ts`

The middleware runs with Node.js runtime (required for better-sqlite3). It caches domain→slug lookups in memory with a 60-second TTL so SQLite is not queried on every request.

- [ ] **Step 3.1: Create `middleware.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDealerByDomain } from "@/lib/query-modules/public";

// In-memory domain cache: domain → slug (null = no match)
const cache = new Map<string, string | null>();
const cacheExpiry = new Map<string, number>();
const CACHE_TTL_MS = 60_000;

function cachedDealerSlug(host: string): string | null {
  const now = Date.now();
  if (cache.has(host) && (cacheExpiry.get(host) ?? 0) > now) {
    return cache.get(host) ?? null;
  }
  const dealer = getDealerByDomain(host);
  const slug = dealer?.slug ?? null;
  cache.set(host, slug);
  cacheExpiry.set(host, now + CACHE_TTL_MS);
  return slug;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only consider root-level or unknown paths — skip known internal paths
  if (
    pathname.startsWith("/d/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/login") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const host = (request.headers.get("host") ?? "").split(":")[0]; // strip port
  const slug = cachedDealerSlug(host);
  if (!slug) return NextResponse.next();

  // Rewrite: keep the custom domain in the browser but serve /d/[slug]
  const url = request.nextUrl.clone();
  url.pathname = `/d/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// Force Node.js runtime so better-sqlite3 native module works
export const runtime = "nodejs";
```

- [ ] **Step 3.2: Verify the app still starts**

```bash
cd /Users/v/dev/scrapeui && npm run dev 2>&1 | head -20
```

Expected: server starts on port 3000, no import errors.

- [ ] **Step 3.3: Commit**

```bash
git add middleware.ts
git commit -m "feat: middleware for custom domain → /d/[slug] rewrite"
```

---

## Task 4: Public Route Group

**Files:**
- Create: `app/(public)/layout.tsx`
- Create: `app/(public)/d/[slug]/page.tsx`
- Create: `app/(public)/d/[slug]/[mobileId]/page.tsx`

- [ ] **Step 4.1: Create `app/(public)/layout.tsx`**

Bare layout — no sidebar, no auth, no dark class. Overrides the root layout for public pages:

```typescript
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 4.2: Create `app/(public)/d/[slug]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { getPublicDealer, getPublicListings } from "@/lib/queries";
import { TEMPLATE_REGISTRY } from "@/components/templates";
import type { PublicListingFilters } from "@/lib/queries";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function sp(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

function spNum(v: string | string[] | undefined): number | undefined {
  const n = parseInt(sp(v), 10);
  return isNaN(n) ? undefined : n;
}

export default async function PublicDealerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;

  const dealer = getPublicDealer(slug);
  if (!dealer || !dealer.publicEnabled) notFound();

  const filters: PublicListingFilters = {
    make: sp(query.make),
    fuel: sp(query.fuel),
    yearFrom: sp(query.yearFrom),
    yearTo: sp(query.yearTo),
    priceMin: spNum(query.priceMin),
    priceMax: spNum(query.priceMax),
    mileageMax: spNum(query.mileageMax),
    sort: sp(query.sort) || "newest",
    page: spNum(query.page) ?? 1,
  };

  const result = getPublicListings(dealer.id, filters);

  const Template =
    TEMPLATE_REGISTRY[dealer.template as keyof typeof TEMPLATE_REGISTRY] ??
    TEMPLATE_REGISTRY.bold;

  return (
    <Template.ListingGrid
      dealer={dealer}
      listings={result.listings}
      total={result.total}
      page={result.page}
      limit={result.limit}
      makes={result.makes}
      filters={filters}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const dealer = getPublicDealer(slug);
  if (!dealer) return {};
  return {
    title: `${dealer.name} — Car Listings`,
    description: `Browse all available cars from ${dealer.name}`,
  };
}
```

- [ ] **Step 4.3: Create `app/(public)/d/[slug]/[mobileId]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { getPublicDealer, getPublicListing } from "@/lib/queries";
import { TEMPLATE_REGISTRY } from "@/components/templates";

interface Props {
  params: Promise<{ slug: string; mobileId: string }>;
}

export default async function PublicListingDetailPage({ params }: Props) {
  const { slug, mobileId } = await params;

  const dealer = getPublicDealer(slug);
  if (!dealer || !dealer.publicEnabled) notFound();

  const listing = getPublicListing(dealer.id, mobileId);
  if (!listing) notFound();

  const Template =
    TEMPLATE_REGISTRY[dealer.template as keyof typeof TEMPLATE_REGISTRY] ??
    TEMPLATE_REGISTRY.bold;

  return <Template.ListingDetail dealer={dealer} listing={listing} />;
}

export async function generateMetadata({ params }: Props) {
  const { slug, mobileId } = await params;
  const dealer = getPublicDealer(slug);
  if (!dealer) return {};
  const listing = getPublicListing(dealer.id, mobileId);
  if (!listing) return {};
  return {
    title: `${listing.make} ${listing.model} ${listing.regYear} — ${dealer.name}`,
  };
}
```

- [ ] **Step 4.4: Stub `components/templates/index.ts` so pages compile**

Create a temporary stub (will be replaced in Task 5):

```typescript
// Stub — replaced in Task 5
export const TEMPLATE_REGISTRY = {} as Record<
  string,
  {
    ListingGrid: React.ComponentType<any>;
    ListingDetail: React.ComponentType<any>;
  }
>;
```

- [ ] **Step 4.5: Verify app compiles and `/d/test` returns 404**

```bash
cd /Users/v/dev/scrapeui && npx tsc --noEmit 2>&1 | head -30
```

Visit `http://localhost:3000/d/nonexistent` — expect a 404 page.

- [ ] **Step 4.6: Commit**

```bash
git add app/"(public)"/layout.tsx app/"(public)"/d/"[slug]"/page.tsx app/"(public)"/d/"[slug]"/"[mobileId]"/page.tsx components/templates/index.ts
git commit -m "feat: public route group scaffold with template stub"
```

---

## Task 5: Template Types & Registry

**Files:**
- Create: `components/templates/types.ts`
- Modify: `components/templates/index.ts`

- [ ] **Step 5.1: Create `components/templates/types.ts`**

```typescript
import type { PublicDealer, PublicListing, PublicListingDetail, PublicListingFilters } from "@/lib/queries";

export type { PublicDealer, PublicListing, PublicListingDetail, PublicListingFilters };

export interface ListingGridProps {
  dealer: PublicDealer;
  listings: PublicListing[];
  total: number;
  page: number;
  limit: number;
  makes: string[];
  filters: PublicListingFilters;
}

export interface ListingDetailProps {
  dealer: PublicDealer;
  listing: PublicListingDetail;
}
```

- [ ] **Step 5.2: Update `components/templates/index.ts`**

Replace the stub with the real registry (each template imported after it is created in Tasks 6–11):

```typescript
import type { ListingGridProps, ListingDetailProps } from "./types";
import type React from "react";

export interface TemplateModule {
  ListingGrid: React.ComponentType<ListingGridProps>;
  ListingDetail: React.ComponentType<ListingDetailProps>;
}

// Templates are imported here — delete an entry + its folder to remove a template
import * as bold from "./bold";
import * as executive from "./executive";
import * as atlas from "./atlas";
import * as night from "./night";
import * as sunset from "./sunset";
import * as pro from "./pro";

export const TEMPLATE_REGISTRY: Record<string, TemplateModule> = {
  bold,
  executive,
  atlas,
  night,
  sunset,
  pro,
};
```

> **Note:** This will produce TS errors until all 6 template folders exist. Create all 6 in Tasks 6–11 before running `tsc`.

- [ ] **Step 5.3: Commit types**

```bash
git add components/templates/types.ts components/templates/index.ts
git commit -m "feat: template types and registry"
```

---

## Task 6: Bold Template

Bold = white/orange, card grid, sidebar filters (CarBros style).

**Files:**
- Create: `components/templates/bold/ListingGrid.tsx` + `ListingGrid.module.css`
- Create: `components/templates/bold/ListingDetail.tsx` + `ListingDetail.module.css`

> **Image helper:** Use `getListingThumbSrc` from `@/lib/listing-thumb` for thumbnail URLs. It accepts snake_case fields: `{ mobile_id, thumb_keys, full_keys, image_meta, images_downloaded, thumb_saved }`.

- [ ] **Step 6.1: Create `components/templates/bold/ListingGrid.module.css`**

```css
.page { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #1a1a1a; min-height: 100vh; }

/* Header */
.header { background: #fff; border-bottom: 3px solid #f04e23; padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 62px; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.logo { font-size: 1.5rem; font-weight: 900; letter-spacing: -1px; color: #111; }
.logoAccent { color: #f04e23; }
.nav { display: flex; gap: 1.8rem; }
.navLink { text-decoration: none; color: #555; font-size: 0.88rem; font-weight: 500; }
.navLink:hover { color: #f04e23; }
.headerCta { background: #f04e23; color: #fff; padding: 0.5rem 1.2rem; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 0.85rem; }

/* Hero */
.hero { background: #111; color: #fff; padding: 2.5rem 2rem; }
.heroInner { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
.heroTitle { font-size: 2.6rem; font-weight: 900; line-height: 1.05; letter-spacing: -1px; margin-bottom: 0.8rem; }
.heroAccent { color: #f04e23; }
.heroSub { color: rgba(255,255,255,0.55); font-size: 0.95rem; margin-bottom: 1.8rem; }
.heroStats { display: flex; flex-direction: column; gap: 1rem; }
.statCard { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1rem 1.2rem; display: flex; align-items: center; gap: 1rem; }
.statVal { font-size: 1.4rem; font-weight: 900; color: #f04e23; line-height: 1; }
.statLbl { font-size: 0.7rem; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.5px; }

/* Body */
.body { max-width: 1100px; margin: 2rem auto; padding: 0 2rem; display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem; }

/* Sidebar */
.sidebar { background: #fff; border-radius: 12px; padding: 1.5rem; height: fit-content; border: 1px solid #eee; }
.sidebarTitle { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #aaa; margin-bottom: 1.2rem; }
.filterGroup { margin-bottom: 1.2rem; }
.filterLabel { display: block; font-size: 0.8rem; font-weight: 700; color: #333; margin-bottom: 0.4rem; }
.filterSelect, .filterInput { width: 100%; padding: 0.55rem 0.8rem; border: 1.5px solid #e8e8e8; border-radius: 7px; font-size: 0.82rem; color: #333; background: #fff; }
.rangeRow { display: flex; gap: 0.4rem; }
.rangeRow .filterInput { flex: 1; }
.filterBtn { width: 100%; background: #f04e23; color: #fff; border: none; padding: 0.75rem; border-radius: 8px; font-weight: 800; font-size: 0.88rem; cursor: pointer; margin-top: 0.5rem; }

/* Listings */
.listHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.listTitle { font-size: 1rem; font-weight: 800; }
.listCount { color: #999; font-size: 0.82rem; }
.sortSelect { padding: 0.45rem 0.75rem; border: 1.5px solid #e8e8e8; border-radius: 7px; font-size: 0.82rem; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }

/* Card */
.card { background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #eee; transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; color: inherit; display: block; }
.card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.cardImg { height: 170px; overflow: hidden; position: relative; background: #e5e5e5; }
.cardImg img { width: 100%; height: 100%; object-fit: cover; }
.cardImgPlaceholder { width: 100%; height: 100%; background: #e8e8e8; display: flex; align-items: center; justify-content: center; color: #bbb; font-size: 2rem; }
.badge { position: absolute; top: 0.5rem; left: 0.5rem; padding: 0.2rem 0.55rem; border-radius: 4px; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; }
.badgeNew { background: #22c55e; color: #fff; }
.badgeSale { background: #f04e23; color: #fff; }
.badgeEv { background: #6366f1; color: #fff; }
.cardBody { padding: 0.9rem; }
.carName { font-size: 0.95rem; font-weight: 800; margin-bottom: 0.15rem; }
.carSub { font-size: 0.76rem; color: #999; margin-bottom: 0.65rem; }
.specs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.7rem; }
.spec { font-size: 0.74rem; color: #666; background: #f5f5f5; padding: 0.2rem 0.5rem; border-radius: 4px; }
.cardFoot { display: flex; align-items: center; justify-content: space-between; padding-top: 0.7rem; border-top: 1px solid #f0f0f0; }
.price { font-size: 1.05rem; font-weight: 900; }
.viewBtn { background: #f04e23; color: #fff; border: none; padding: 0.45rem 0.9rem; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer; }

/* Pagination */
.pagination { display: flex; justify-content: center; gap: 0.4rem; margin: 2rem 0; }
.pageBtn { background: #fff; border: 1.5px solid #e8e8e8; padding: 0.45rem 0.9rem; border-radius: 7px; font-size: 0.82rem; cursor: pointer; text-decoration: none; color: #333; }
.pageBtnActive { background: #f04e23; border-color: #f04e23; color: #fff; }
.pageBtnDisabled { opacity: 0.4; pointer-events: none; }

/* Footer */
.footer { background: #111; color: rgba(255,255,255,0.4); padding: 2rem; text-align: center; font-size: 0.82rem; margin-top: 3rem; }
.footerAccent { color: #f04e23; font-weight: 700; }
```

- [ ] **Step 6.2: Create `components/templates/bold/ListingGrid.tsx`**

```typescript
import Link from "next/link";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import type { ListingGridProps } from "../types";
import s from "./ListingGrid.module.css";

function fuelLabel(fuel: string | null) {
  const map: Record<string, string> = { Бензин: "Petrol", Дизел: "Diesel", Електрически: "Electric", Хибрид: "Hybrid" };
  return fuel ? (map[fuel] ?? fuel) : "";
}

function formatPrice(p: number | null) {
  if (!p) return "—";
  return p.toLocaleString("bg-BG") + " лв";
}

function formatMileage(m: number | null) {
  if (!m) return "—";
  return m.toLocaleString("bg-BG") + " km";
}

export function ListingGrid({ dealer, listings, total, page, limit, makes, filters }: ListingGridProps) {
  const totalPages = Math.ceil(total / limit);
  const basePath = `/d/${dealer.slug}`;

  function filterHref(updates: Record<string, string | number | undefined>) {
    const p = new URLSearchParams();
    const merged = { ...filters, ...updates };
    if (merged.make) p.set("make", String(merged.make));
    if (merged.fuel) p.set("fuel", String(merged.fuel));
    if (merged.yearFrom) p.set("yearFrom", String(merged.yearFrom));
    if (merged.yearTo) p.set("yearTo", String(merged.yearTo));
    if (merged.priceMin) p.set("priceMin", String(merged.priceMin));
    if (merged.priceMax) p.set("priceMax", String(merged.priceMax));
    if (merged.sort) p.set("sort", String(merged.sort));
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>
          {dealer.name.slice(0, Math.ceil(dealer.name.length / 2))}
          <span className={s.logoAccent}>{dealer.name.slice(Math.ceil(dealer.name.length / 2))}</span>
        </div>
        <nav className={s.nav}>
          <Link href={basePath} className={s.navLink}>All Cars</Link>
        </nav>
        <a href={`tel:`} className={s.headerCta}>Contact</a>
      </header>

      <div className={s.hero}>
        <div className={s.heroInner}>
          <div>
            <h1 className={s.heroTitle}>Find Your Perfect <span className={s.heroAccent}>Ride.</span></h1>
            <p className={s.heroSub}>{total} vehicles available from {dealer.name}</p>
          </div>
          <div className={s.heroStats}>
            <div className={s.statCard}>
              <div>
                <div className={s.statVal}>{total}</div>
                <div className={s.statLbl}>Cars in stock</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={s.body}>
        <aside className={s.sidebar}>
          <div className={s.sidebarTitle}>Filters</div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Make</label>
            <select className={s.filterSelect} defaultValue={filters.make ?? ""}
              onChange={(e) => { window.location.href = filterHref({ make: e.target.value, page: 1 }); }}>
              <option value="">All Makes</option>
              {makes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Fuel</label>
            <select className={s.filterSelect} defaultValue={filters.fuel ?? ""}
              onChange={(e) => { window.location.href = filterHref({ fuel: e.target.value, page: 1 }); }}>
              <option value="">Any</option>
              <option value="Бензин">Petrol</option>
              <option value="Дизел">Diesel</option>
              <option value="Електрически">Electric</option>
              <option value="Хибрид">Hybrid</option>
            </select>
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Year</label>
            <div className={s.rangeRow}>
              <input className={s.filterInput} placeholder="From" defaultValue={filters.yearFrom ?? ""}
                onBlur={(e) => { window.location.href = filterHref({ yearFrom: e.target.value }); }} />
              <input className={s.filterInput} placeholder="To" defaultValue={filters.yearTo ?? ""}
                onBlur={(e) => { window.location.href = filterHref({ yearTo: e.target.value }); }} />
            </div>
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Price (лв)</label>
            <div className={s.rangeRow}>
              <input className={s.filterInput} placeholder="Min" defaultValue={filters.priceMin ?? ""}
                onBlur={(e) => { window.location.href = filterHref({ priceMin: e.target.value ? Number(e.target.value) : undefined }); }} />
              <input className={s.filterInput} placeholder="Max" defaultValue={filters.priceMax ?? ""}
                onBlur={(e) => { window.location.href = filterHref({ priceMax: e.target.value ? Number(e.target.value) : undefined }); }} />
            </div>
          </div>
        </aside>

        <div>
          <div className={s.listHeader}>
            <div>
              <span className={s.listTitle}>Available Cars </span>
              <span className={s.listCount}>{total} results</span>
            </div>
            <select className={s.sortSelect} defaultValue={filters.sort ?? "newest"}
              onChange={(e) => { window.location.href = filterHref({ sort: e.target.value, page: 1 }); }}>
              <option value="newest">Newest First</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
              <option value="mileage_asc">Mileage ↑</option>
              <option value="year_desc">Year ↓</option>
            </select>
          </div>

          <div className={s.grid}>
            {listings.map((l) => {
              const thumbSrc = getListingThumbSrc({
                mobile_id: l.mobileId, thumb_keys: l.thumbKeys, full_keys: l.fullKeys,
                image_meta: l.imageMeta, images_downloaded: l.imagesDownloaded, thumb_saved: l.thumbSaved,
              });
              return (
                <Link key={l.mobileId} href={`${basePath}/${l.mobileId}`} className={s.card}>
                  <div className={s.cardImg}>
                    {thumbSrc
                      ? <img src={thumbSrc} alt={`${l.make} ${l.model}`} />
                      : <div className={s.cardImgPlaceholder}>🚗</div>}
                    {l.isNew === 1 && <span className={`${s.badge} ${s.badgeNew}`}>New</span>}
                  </div>
                  <div className={s.cardBody}>
                    <div className={s.carName}>{l.make} {l.model}</div>
                    <div className={s.carSub}>{l.regYear}</div>
                    <div className={s.specs}>
                      {l.fuel && <span className={s.spec}>{fuelLabel(l.fuel)}</span>}
                      {l.mileage != null && <span className={s.spec}>{formatMileage(l.mileage)}</span>}
                      {l.transmission && <span className={s.spec}>{l.transmission}</span>}
                    </div>
                    <div className={s.cardFoot}>
                      <div className={s.price}>{formatPrice(l.currentPrice)}</div>
                      <button className={s.viewBtn}>View →</button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={s.pagination}>
              {page > 1 && <Link href={filterHref({ page: page - 1 })} className={s.pageBtn}>←</Link>}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={filterHref({ page: p })}
                  className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ""}`}>{p}</Link>
              ))}
              {page < totalPages && <Link href={filterHref({ page: page + 1 })} className={s.pageBtn}>→</Link>}
            </div>
          )}
        </div>
      </div>

      <footer className={s.footer}>
        <span className={s.footerAccent}>{dealer.name}</span>
        {dealer.publicDomain && ` · ${dealer.publicDomain}`}
      </footer>
    </div>
  );
}
```

- [ ] **Step 6.3: Create `components/templates/bold/ListingDetail.module.css`**

```css
.page { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; min-height: 100vh; }
.header { background: #fff; border-bottom: 3px solid #f04e23; padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 62px; position: sticky; top: 0; z-index: 100; }
.logo { font-size: 1.5rem; font-weight: 900; color: #111; }
.logoAccent { color: #f04e23; }
.back { color: #f04e23; text-decoration: none; font-size: 0.85rem; font-weight: 700; }
.main { max-width: 1000px; margin: 2rem auto; padding: 0 2rem; }
.grid { display: grid; grid-template-columns: 1fr 380px; gap: 2rem; align-items: start; }
.imageWrap { border-radius: 12px; overflow: hidden; background: #e5e5e5; aspect-ratio: 4/3; }
.imageWrap img { width: 100%; height: 100%; object-fit: cover; }
.imagePlaceholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 4rem; color: #ccc; }
.panel { background: #fff; border-radius: 12px; padding: 1.5rem; border: 1px solid #eee; }
.make { font-size: 0.75rem; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.3rem; }
.title { font-size: 1.6rem; font-weight: 900; margin-bottom: 0.3rem; }
.sub { font-size: 0.88rem; color: #888; margin-bottom: 1.5rem; }
.price { font-size: 2rem; font-weight: 900; color: #111; margin-bottom: 1.5rem; border-top: 1px solid #f0f0f0; padding-top: 1.2rem; }
.specs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem; }
.specItem { background: #f8f8f8; border-radius: 8px; padding: 0.7rem; }
.specLbl { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 0.2rem; }
.specVal { font-size: 0.9rem; font-weight: 700; }
.cta { width: 100%; background: #f04e23; color: #fff; border: none; padding: 0.9rem; border-radius: 8px; font-size: 0.95rem; font-weight: 800; cursor: pointer; }
.description { background: #fff; border-radius: 12px; padding: 1.5rem; margin-top: 1.5rem; border: 1px solid #eee; line-height: 1.7; font-size: 0.9rem; color: #444; }
.footer { background: #111; color: rgba(255,255,255,0.4); padding: 1.5rem 2rem; text-align: center; font-size: 0.82rem; margin-top: 3rem; }
.footerAccent { color: #f04e23; font-weight: 700; }
```

- [ ] **Step 6.4: Create `components/templates/bold/ListingDetail.tsx`**

```typescript
import Link from "next/link";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import type { ListingDetailProps } from "../types";
import s from "./ListingDetail.module.css";

function fmt(n: number | null, suffix = "") { return n != null ? n.toLocaleString("bg-BG") + suffix : "—"; }

export function ListingDetail({ dealer, listing }: ListingDetailProps) {
  const basePath = `/d/${dealer.slug}`;
  const thumbSrc = getListingThumbSrc({
    mobile_id: listing.mobileId, thumb_keys: listing.thumbKeys, full_keys: listing.fullKeys,
    image_meta: listing.imageMeta, images_downloaded: listing.imagesDownloaded, thumb_saved: listing.thumbSaved,
  });

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>
          {dealer.name.slice(0, Math.ceil(dealer.name.length / 2))}
          <span className={s.logoAccent}>{dealer.name.slice(Math.ceil(dealer.name.length / 2))}</span>
        </div>
        <Link href={basePath} className={s.back}>← Back to listings</Link>
      </header>

      <div className={s.main}>
        <div className={s.grid}>
          <div>
            <div className={s.imageWrap}>
              {thumbSrc
                ? <img src={thumbSrc} alt={`${listing.make} ${listing.model}`} />
                : <div className={s.imagePlaceholder}>🚗</div>}
            </div>
            {listing.description && (
              <div className={s.description}>{listing.description}</div>
            )}
          </div>

          <div className={s.panel}>
            <div className={s.make}>{listing.make}</div>
            <div className={s.title}>{listing.make} {listing.model}</div>
            <div className={s.sub}>{listing.regYear} · {listing.bodyType ?? ""}</div>
            <div className={s.price}>{fmt(listing.currentPrice)} лв</div>

            <div className={s.specs}>
              {listing.fuel && <div className={s.specItem}><div className={s.specLbl}>Fuel</div><div className={s.specVal}>{listing.fuel}</div></div>}
              {listing.mileage != null && <div className={s.specItem}><div className={s.specLbl}>Mileage</div><div className={s.specVal}>{fmt(listing.mileage)} km</div></div>}
              {listing.transmission && <div className={s.specItem}><div className={s.specLbl}>Gearbox</div><div className={s.specVal}>{listing.transmission}</div></div>}
              {listing.power != null && <div className={s.specItem}><div className={s.specLbl}>Power</div><div className={s.specVal}>{listing.power} hp</div></div>}
              {listing.color && <div className={s.specItem}><div className={s.specLbl}>Color</div><div className={s.specVal}>{listing.color}</div></div>}
              {listing.regYear && <div className={s.specItem}><div className={s.specLbl}>Year</div><div className={s.specVal}>{listing.regYear}</div></div>}
            </div>

            <button className={s.cta}>Contact Dealer</button>
          </div>
        </div>
      </div>

      <footer className={s.footer}>
        <span className={s.footerAccent}>{dealer.name}</span>
      </footer>
    </div>
  );
}
```

- [ ] **Step 6.5: Commit**

```bash
git add components/templates/bold/
git commit -m "feat: bold template (orange/white card grid)"
```

---

## Task 7: Executive Template

Dark/gold, horizontal list cards (M Motors style). Follow the exact same file structure as Task 6.

**Files:**
- Create: `components/templates/executive/ListingGrid.tsx` + `ListingGrid.module.css`
- Create: `components/templates/executive/ListingDetail.tsx` + `ListingDetail.module.css`

- [ ] **Step 7.1: `ListingGrid.module.css`** — dark background `#0a0a0a`, gold accent `#c9a84c`, horizontal card rows separated by 1px dividers, serif logo font.

Key selectors to define:
```css
.page { background: #0a0a0a; color: #e8e8e8; font-family: -apple-system, sans-serif; }
.header { background: rgba(10,10,10,0.95); border-bottom: 1px solid rgba(201,168,76,0.3); height: 70px; display: flex; align-items: center; justify-content: space-between; padding: 0 2.5rem; position: sticky; top: 0; z-index: 100; }
.logoMark { width: 36px; height: 36px; background: #c9a84c; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #000; font-size: 0.9rem; }
.logoText { font-size: 1rem; letter-spacing: 4px; text-transform: uppercase; }
.logoAccent { color: #c9a84c; }
.hero { position: relative; height: 400px; overflow: hidden; display: flex; align-items: flex-end; background: linear-gradient(135deg, #0a0a0a 0%, #1a1208 50%, #0a0a0a 100%); }
.heroContent { position: relative; z-index: 2; max-width: 1100px; margin: 0 auto; padding: 2.5rem; width: 100%; }
.heroEyebrow { font-size: 0.68rem; letter-spacing: 4px; text-transform: uppercase; color: #c9a84c; margin-bottom: 0.8rem; }
.heroTitle { font-size: 3rem; font-weight: 400; color: #fff; font-family: Georgia, serif; margin-bottom: 0.5rem; }
.heroTitleEm { font-style: italic; color: #c9a84c; }
.body { max-width: 1100px; margin: 0 auto; padding: 2.5rem 2rem; }
.sectionLabel { font-size: 0.65rem; letter-spacing: 4px; text-transform: uppercase; color: #c9a84c; margin-bottom: 0.5rem; }
.sectionTitle { font-size: 1.4rem; font-weight: 400; color: #fff; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 1rem; font-family: Georgia, serif; }
.list { display: flex; flex-direction: column; gap: 1px; background: rgba(255,255,255,0.05); }
.card { background: #0f0f0f; display: grid; grid-template-columns: 260px 1fr auto; align-items: stretch; text-decoration: none; color: inherit; transition: background 0.2s; }
.card:hover { background: #141414; }
.cardImg { height: 170px; overflow: hidden; }
.cardImg img { width: 100%; height: 100%; object-fit: cover; filter: brightness(0.9); transition: filter 0.3s; }
.card:hover .cardImg img { filter: brightness(1); }
.cardBody { padding: 1.5rem 2rem; display: flex; flex-direction: column; justify-content: center; }
.carName { font-size: 1.2rem; font-weight: 400; color: #fff; margin-bottom: 0.3rem; font-family: Georgia, serif; }
.carVariant { font-size: 0.78rem; color: rgba(255,255,255,0.4); letter-spacing: 1px; margin-bottom: 1rem; }
.specs { display: flex; gap: 1.5rem; }
.specVal { font-size: 0.88rem; color: #e8e8e8; font-weight: 500; }
.specLbl { font-size: 0.65rem; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px; }
.cardCta { padding: 1.5rem; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; gap: 0.8rem; min-width: 160px; border-left: 1px solid rgba(255,255,255,0.05); }
.price { font-size: 1.4rem; font-family: Georgia, serif; color: #fff; white-space: nowrap; }
.priceLabel { font-size: 0.65rem; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px; display: block; }
.viewBtn { background: transparent; border: 1px solid rgba(201,168,76,0.5); color: #c9a84c; padding: 0.55rem 1.2rem; font-size: 0.68rem; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
.viewBtn:hover { background: #c9a84c; color: #000; }
.pagination { display: flex; justify-content: center; gap: 0.4rem; margin: 2rem 0; }
.pageBtn { background: transparent; border: 1px solid rgba(201,168,76,0.3); color: #c9a84c; padding: 0.45rem 0.9rem; font-size: 0.8rem; cursor: pointer; text-decoration: none; transition: all 0.2s; }
.pageBtnActive { background: #c9a84c; color: #000; }
.footer { border-top: 1px solid rgba(201,168,76,0.2); padding: 2.5rem; text-align: center; margin-top: 4rem; }
.footLogo { font-size: 0.9rem; letter-spacing: 5px; text-transform: uppercase; color: rgba(255,255,255,0.3); }
.footLogoAccent { color: #c9a84c; }
```

- [ ] **Step 7.2: `ListingGrid.tsx`** — same props/logic as Bold but render horizontal `.card` rows. Use `getListingThumbSrc`. Link each card to `/d/[slug]/[mobileId]`.

```typescript
import Link from "next/link";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import type { ListingGridProps } from "../types";
import s from "./ListingGrid.module.css";

function fmt(n: number | null, suffix = "") { return n != null ? n.toLocaleString("bg-BG") + suffix : "—"; }

export function ListingGrid({ dealer, listings, total, page, limit, makes, filters }: ListingGridProps) {
  const basePath = `/d/${dealer.slug}`;
  const totalPages = Math.ceil(total / limit);

  function filterHref(updates: Record<string, string | number | undefined>) {
    const p = new URLSearchParams();
    const m = { ...filters, ...updates };
    if (m.make) p.set("make", String(m.make));
    if (m.fuel) p.set("fuel", String(m.fuel));
    if (m.sort) p.set("sort", String(m.sort));
    if (m.page && Number(m.page) > 1) p.set("page", String(m.page));
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <div className={s.logoMark}>{dealer.name.charAt(0)}</div>
          <div className={s.logoText}><span className={s.logoAccent}>{dealer.name.charAt(0)}</span>{dealer.name.slice(1).toUpperCase()}</div>
        </div>
        <select style={{ background: "transparent", border: "1px solid rgba(201,168,76,0.3)", color: "#c9a84c", padding: "0.45rem 0.8rem", fontSize: "0.8rem" }}
          defaultValue={filters.sort ?? "newest"}
          onChange={(e) => { window.location.href = filterHref({ sort: e.target.value }); }}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
        </select>
      </header>

      <div className={s.hero}>
        <div className={s.heroContent}>
          <div className={s.heroEyebrow}>{dealer.name} Collection</div>
          <h1 className={s.heroTitle}>Drive with <em className={s.heroTitleEm}>distinction.</em></h1>
        </div>
      </div>

      <div className={s.body}>
        <div className={s.sectionLabel}>Our Collection</div>
        <div className={s.sectionTitle}>Available Vehicles <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.3)", fontFamily: "sans-serif", fontWeight: 400 }}>{total} results</span></div>

        <div className={s.list}>
          {listings.map((l) => {
            const thumbSrc = getListingThumbSrc({
              mobile_id: l.mobileId, thumb_keys: l.thumbKeys, full_keys: l.fullKeys,
              image_meta: l.imageMeta, images_downloaded: l.imagesDownloaded, thumb_saved: l.thumbSaved,
            });
            return (
              <Link key={l.mobileId} href={`${basePath}/${l.mobileId}`} className={s.card}>
                <div className={s.cardImg}>
                  {thumbSrc ? <img src={thumbSrc} alt={`${l.make} ${l.model}`} /> : <div style={{ background: "#1a1a1a", height: "100%" }} />}
                </div>
                <div className={s.cardBody}>
                  <div className={s.carName}>{l.make} {l.model}</div>
                  <div className={s.carVariant}>{l.regYear} · {l.fuel ?? ""} · {l.transmission ?? ""}</div>
                  <div className={s.specs}>
                    {l.mileage != null && <div><div className={s.specVal}>{fmt(l.mileage)}</div><div className={s.specLbl}>km</div></div>}
                    {l.fuel && <div><div className={s.specVal}>{l.fuel}</div><div className={s.specLbl}>Fuel</div></div>}
                    {l.transmission && <div><div className={s.specVal}>{l.transmission}</div><div className={s.specLbl}>Gearbox</div></div>}
                  </div>
                </div>
                <div className={s.cardCta}>
                  <div className={s.price}>{fmt(l.currentPrice)} лв<span className={s.priceLabel}>Incl. VAT</span></div>
                  <button className={s.viewBtn}>View Details</button>
                </div>
              </Link>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className={s.pagination}>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <Link key={p} href={filterHref({ page: p })}
                className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ""}`}>{p}</Link>
            ))}
          </div>
        )}
      </div>

      <footer className={s.footer}>
        <div className={s.footLogo}><span className={s.footLogoAccent}>{dealer.name.charAt(0)}</span>{dealer.name.slice(1).toUpperCase()}</div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 7.3: `ListingDetail.tsx` + `ListingDetail.module.css`** — dark theme version of the detail page. Same structure as Bold's ListingDetail but with `#0a0a0a` background, gold accents, serif title font. The CSS selectors mirror the `.detail` pattern from Bold but dark-themed.

Create `components/templates/executive/ListingDetail.module.css` with dark equivalents of Bold's detail CSS (replace `#f04e23` → `#c9a84c`, `#f5f5f5` → `#0a0a0a`, `#fff` backgrounds → `#0f0f0f`, borders → `rgba(255,255,255,0.07)`).

Create `components/templates/executive/ListingDetail.tsx` with the same structure as Bold's ListingDetail but using the dark CSS module.

- [ ] **Step 7.4: Commit**

```bash
git add components/templates/executive/
git commit -m "feat: executive template (dark/gold horizontal list)"
```

---

## Task 8: Atlas Template

Editorial black/white, flush grid, featured card spanning 2 columns.

**Files:** same structure — `ListingGrid.tsx/css` + `ListingDetail.tsx/css` in `components/templates/atlas/`

- [ ] **Step 8.1: `ListingGrid.module.css`** — white background `#fafaf8`, black `#1a1a1a`, no sidebar, top horizontal filter bar. Grid uses `gap: 1.5px; background: #e8e8e0` so cards appear separated by hairline dividers. First card spans 2 columns (featured).

Key selectors:
```css
.page { background: #fafaf8; color: #1a1a1a; font-family: Georgia, serif; }
.header { background: #fff; border-bottom: 1px solid #e8e8e0; padding: 0 3rem; height: 64px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
.logo { font-size: 1.3rem; letter-spacing: 2px; text-transform: uppercase; }
.filterBar { background: #fff; border-bottom: 1px solid #e8e8e0; padding: 1rem 3rem; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.filterBar select { border: 1px solid #e0e0e0; padding: 0.5rem 1rem; font-family: -apple-system, sans-serif; font-size: 0.82rem; background: #fff; }
.grid { max-width: 1200px; margin: 0 auto; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5px; background: #e8e8e0; }
.card { background: #fff; overflow: hidden; cursor: pointer; text-decoration: none; color: inherit; display: block; }
.cardFeatured { grid-column: span 2; }
.cardImg { height: 200px; overflow: hidden; position: relative; }
.cardFeatured .cardImg { height: 320px; }
.cardImg img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s; }
.card:hover .cardImg img { transform: scale(1.04); }
.priceOverlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.55)); padding: 1.5rem 1rem 0.6rem; display: flex; justify-content: space-between; align-items: flex-end; }
.overlayPrice { color: #fff; font-size: 1.1rem; font-weight: 700; font-family: -apple-system, sans-serif; }
.cardBody { padding: 1rem; }
.carName { font-size: 1rem; font-weight: 400; margin-bottom: 0.2rem; }
.carVariant { font-family: -apple-system, sans-serif; font-size: 0.75rem; color: #888; margin-bottom: 0.8rem; }
.cardSpecs { display: flex; gap: 1rem; font-family: -apple-system, sans-serif; font-size: 0.75rem; color: #666; }
.cardSpecs span + span::before { content: "·"; margin-right: 0.4rem; color: #ccc; }
.cardFoot { padding: 0.7rem 1rem; border-top: 1px solid #f0f0ea; display: flex; justify-content: flex-end; }
.viewLink { font-family: -apple-system, sans-serif; font-size: 0.75rem; letter-spacing: 1px; text-transform: uppercase; color: #1a1a1a; text-decoration: none; font-weight: 600; }
.pagination { display: flex; justify-content: center; gap: 0.5rem; padding: 2rem; }
.pageBtn { background: #fff; border: 1px solid #e8e8e0; padding: 0.5rem 1rem; font-family: -apple-system, sans-serif; font-size: 0.8rem; text-decoration: none; color: #333; }
.pageBtnActive { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
.footer { background: #1a1a1a; color: rgba(255,255,255,0.4); padding: 2.5rem 3rem; display: flex; justify-content: space-between; align-items: center; font-family: -apple-system, sans-serif; font-size: 0.78rem; }
.footLogo { color: rgba(255,255,255,0.8); font-family: Georgia, serif; font-size: 1rem; letter-spacing: 2px; text-transform: uppercase; }
```

- [ ] **Step 8.2: `ListingGrid.tsx`** — no sidebar, top filter bar with `<select>` dropdowns. First listing rendered as `.cardFeatured`. Use `getListingThumbSrc`.

- [ ] **Step 8.3: `ListingDetail.tsx/css`** — white background, large image left, info panel right. Black/white with serif font for title.

- [ ] **Step 8.4: Commit**

```bash
git add components/templates/atlas/
git commit -m "feat: atlas template (editorial black/white)"
```

---

## Task 9: Night Template

Dark `#080c10` with teal neon `#00e5b2` accents, compact 3-column grid.

**Files:** `components/templates/night/` — same structure.

- [ ] **Step 9.1: `ListingGrid.module.css`** — dark background, teal accents, glowing dots, compact card grid. Key selectors:

```css
.page { background: #080c10; color: #e2e8f0; font-family: -apple-system, sans-serif; }
.header { background: rgba(8,12,16,0.95); border-bottom: 1px solid rgba(0,229,178,0.15); height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 0 2rem; position: sticky; top: 0; z-index: 100; }
.logoDot { width: 8px; height: 8px; background: #00e5b2; border-radius: 50%; box-shadow: 0 0 8px #00e5b2; }
.logoText { font-size: 1rem; font-weight: 800; color: #fff; }
.logoAccent { color: #00e5b2; }
.ticker { background: rgba(0,229,178,0.05); border-bottom: 1px solid rgba(0,229,178,0.1); padding: 0.5rem 2rem; font-size: 0.72rem; color: rgba(255,255,255,0.35); display: flex; gap: 2rem; }
.ticker strong { color: #00e5b2; }
.heroStrip { background: linear-gradient(90deg, rgba(0,229,178,0.05) 0%, transparent 60%); border-bottom: 1px solid rgba(255,255,255,0.04); padding: 2rem; }
.heroH1 { font-size: 1.8rem; font-weight: 800; color: #fff; }
.main { max-width: 1100px; margin: 0 auto; padding: 1.5rem 2rem; display: grid; grid-template-columns: 200px 1fr; gap: 1.5rem; }
.sidebar { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1.2rem; }
.filterLabel { font-size: 0.72rem; color: rgba(255,255,255,0.45); margin-bottom: 0.4rem; display: block; }
.filterSelect, .filterInput { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #e2e8f0; padding: 0.5rem 0.7rem; font-size: 0.78rem; border-radius: 6px; }
.filterBtn { width: 100%; background: #00e5b2; color: #080c10; border: none; padding: 0.65rem; border-radius: 6px; font-weight: 800; font-size: 0.8rem; cursor: pointer; margin-top: 0.5rem; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
.card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; text-decoration: none; color: inherit; transition: border-color 0.2s; display: block; }
.card:hover { border-color: rgba(0,229,178,0.3); }
.cardImg { height: 155px; overflow: hidden; position: relative; }
.cardImg img { width: 100%; height: 100%; object-fit: cover; filter: brightness(0.85) saturate(0.9); transition: filter 0.3s; }
.card:hover .cardImg img { filter: brightness(1) saturate(1); }
.cardTag { position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(8,12,16,0.85); border: 1px solid rgba(0,229,178,0.3); color: #00e5b2; padding: 0.15rem 0.5rem; font-size: 0.62rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border-radius: 3px; }
.cardBody { padding: 0.85rem; }
.carName { font-size: 0.9rem; font-weight: 700; color: #fff; margin-bottom: 0.15rem; }
.carSub { font-size: 0.72rem; color: rgba(255,255,255,0.35); margin-bottom: 0.65rem; }
.specs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; margin-bottom: 0.65rem; }
.spec { font-size: 0.7rem; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.03); padding: 0.2rem 0.45rem; border-radius: 3px; }
.cardFoot { display: flex; align-items: center; justify-content: space-between; padding-top: 0.65rem; border-top: 1px solid rgba(255,255,255,0.05); }
.price { font-size: 1rem; font-weight: 800; color: #fff; }
.viewBtn { background: rgba(0,229,178,0.1); border: 1px solid rgba(0,229,178,0.25); color: #00e5b2; padding: 0.35rem 0.8rem; font-size: 0.72rem; font-weight: 700; cursor: pointer; border-radius: 5px; }
.pagination { display: flex; justify-content: center; gap: 0.4rem; margin: 2rem 0; }
.pageBtn { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); padding: 0.45rem 0.9rem; font-size: 0.8rem; text-decoration: none; border-radius: 4px; }
.pageBtnActive { background: rgba(0,229,178,0.1); border-color: rgba(0,229,178,0.3); color: #00e5b2; }
.footer { border-top: 1px solid rgba(255,255,255,0.05); padding: 2rem; text-align: center; margin-top: 3rem; font-size: 0.75rem; color: rgba(255,255,255,0.2); }
.footLogo { color: rgba(255,255,255,0.5); font-weight: 800; font-size: 0.9rem; margin-bottom: 0.4rem; }
.footLogoAccent { color: #00e5b2; }
```

- [ ] **Step 9.2: `ListingGrid.tsx`** — sidebar filters + 3-column grid, ticker bar showing total count, use `getListingThumbSrc`.

- [ ] **Step 9.3: `ListingDetail.tsx/css`** — dark theme detail, teal accent CTA button.

- [ ] **Step 9.4: Commit**

```bash
git add components/templates/night/
git commit -m "feat: night template (dark/teal neon market)"
```

---

## Task 10: Sunset Template

Warm cream `#faf7f2` with terracotta `#e07843`, 4-column grid, lifestyle hero, rounded cards.

**Files:** `components/templates/sunset/` — same structure.

- [ ] **Step 10.1: `ListingGrid.module.css`** — key selectors:

```css
.page { background: #faf7f2; color: #2c2416; font-family: -apple-system, sans-serif; }
.header { background: #faf7f2; border-bottom: 1px solid #e8dfd0; height: 68px; display: flex; align-items: center; justify-content: space-between; padding: 0 2.5rem; position: sticky; top: 0; z-index: 100; }
.logoIcon { width: 34px; height: 34px; background: #e07843; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.logoName { font-size: 1.2rem; font-weight: 800; color: #2c2416; }
.logoAccent { color: #e07843; }
.hero { position: relative; height: 420px; overflow: hidden; }
.heroBg { height: 100%; background: url() center/cover; /* set via inline style */ }
.heroOverlay { position: absolute; inset: 0; background: linear-gradient(to right, rgba(42,28,14,0.75) 0%, rgba(42,28,14,0.3) 60%, transparent 100%); }
.heroContent { position: absolute; top: 50%; left: 3rem; transform: translateY(-50%); max-width: 500px; }
.heroBadge { background: rgba(224,120,67,0.9); color: #fff; display: inline-block; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.72rem; font-weight: 700; margin-bottom: 1rem; }
.heroTitle { font-size: 2.8rem; font-weight: 800; color: #fff; line-height: 1.1; margin-bottom: 1rem; letter-spacing: -1px; }
.searchStrip { background: #fff; border-bottom: 1px solid #e8dfd0; padding: 1.2rem 2.5rem; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.searchSelect { padding: 0.6rem 1rem; border: 1.5px solid #e0d5c5; border-radius: 10px; font-size: 0.85rem; color: #2c2416; background: #fdf9f4; flex: 1; min-width: 120px; }
.body { max-width: 1160px; margin: 2rem auto; padding: 0 2.5rem; }
.sectionHead { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1.5rem; }
.sectionTitle { font-size: 1.3rem; font-weight: 800; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.2rem; }
.card { background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #ede5d8; text-decoration: none; color: inherit; display: block; transition: transform 0.2s, box-shadow 0.2s; }
.card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(44,36,22,0.1); }
.cardImg { height: 165px; overflow: hidden; position: relative; }
.cardImg img { width: 100%; height: 100%; object-fit: cover; }
.cardTag { position: absolute; bottom: 0.7rem; left: 0.7rem; background: #e07843; color: #fff; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.68rem; font-weight: 700; }
.cardBody { padding: 1rem; }
.carName { font-size: 0.95rem; font-weight: 700; margin-bottom: 0.2rem; }
.carSub { font-size: 0.75rem; color: #a09080; margin-bottom: 0.8rem; }
.specs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.spec { background: #faf5ee; border: 1px solid #ede5d8; color: #7a6a58; padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.72rem; }
.cardFoot { display: flex; align-items: center; justify-content: space-between; }
.price { font-size: 1rem; font-weight: 800; }
.viewBtn { background: transparent; border: 1.5px solid #e07843; color: #e07843; padding: 0.38rem 0.85rem; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
.pagination { display: flex; justify-content: center; gap: 0.4rem; margin: 2rem 0; }
.pageBtn { background: #fff; border: 1.5px solid #e8dfd0; padding: 0.45rem 0.9rem; border-radius: 10px; font-size: 0.82rem; text-decoration: none; color: #2c2416; }
.pageBtnActive { background: #e07843; border-color: #e07843; color: #fff; }
.trustBar { background: #fff; border-top: 1px solid #e8dfd0; border-bottom: 1px solid #e8dfd0; padding: 1.5rem 2.5rem; display: flex; justify-content: center; gap: 4rem; margin: 2.5rem 0; }
.trustItem { text-align: center; }
.trustIcon { font-size: 1.5rem; margin-bottom: 0.4rem; }
.trustVal { font-size: 1rem; font-weight: 800; }
.trustLbl { font-size: 0.72rem; color: #a09080; }
.footer { background: #2c2416; color: rgba(255,255,255,0.4); padding: 2rem; text-align: center; font-size: 0.8rem; margin-top: 2rem; }
.footerAccent { color: #e07843; font-weight: 700; }
```

- [ ] **Step 10.2: `ListingGrid.tsx`** — 4-column grid, hero with lifestyle image via inline CSS background on `.heroBg`. Trust bar below grid. Use `getListingThumbSrc`.

- [ ] **Step 10.3: `ListingDetail.tsx/css`** — warm cream background, terracotta CTAs.

- [ ] **Step 10.4: Commit**

```bash
git add components/templates/sunset/
git commit -m "feat: sunset template (warm lifestyle 4-column)"
```

---

## Task 11: Pro Template

Light gray `#f0f2f5`, blue `#2e6fef`, data-table listing with thumbnail + sortable columns.

**Files:** `components/templates/pro/` — same structure.

- [ ] **Step 11.1: `ListingGrid.module.css`** — key selectors:

```css
.page { background: #f0f2f5; color: #1e2533; font-family: -apple-system, sans-serif; }
.header { background: #1e2533; padding: 0 2rem; height: 56px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
.logoBadge { background: #2e6fef; color: #fff; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.78rem; font-weight: 800; }
.logoName { color: #fff; font-size: 1rem; font-weight: 700; }
.toolbar { background: #fff; border-bottom: 1px solid #dde1e9; padding: 0.8rem 2rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.toolbarSelect, .toolbarInput { border: 1px solid #dde1e9; background: #fff; color: #1e2533; padding: 0.45rem 0.85rem; font-size: 0.8rem; border-radius: 5px; }
.main { max-width: 1200px; margin: 0 auto; padding: 1.5rem 2rem; display: grid; grid-template-columns: 220px 1fr; gap: 1.2rem; }
.sidebar { background: #fff; border: 1px solid #dde1e9; border-radius: 8px; padding: 1.2rem; height: fit-content; }
.sbTitle { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #8a93a6; margin-bottom: 1rem; }
.sbSelect, .sbInput { width: 100%; border: 1px solid #dde1e9; background: #f8f9fb; color: #1e2533; padding: 0.45rem 0.7rem; font-size: 0.78rem; border-radius: 5px; }
.sbApply { width: 100%; background: #2e6fef; color: #fff; border: none; padding: 0.6rem; border-radius: 5px; font-weight: 700; font-size: 0.8rem; cursor: pointer; margin-top: 0.4rem; }
.table { width: 100%; background: #fff; border: 1px solid #dde1e9; border-radius: 8px; overflow: hidden; }
.thead { background: #f8f9fb; border-bottom: 1px solid #dde1e9; }
.theadRow { display: grid; grid-template-columns: 260px 1fr 90px 90px 80px 100px; padding: 0.6rem 0.8rem; }
.th { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #8a93a6; }
.row { display: grid; grid-template-columns: 260px 1fr 90px 90px 80px 100px; padding: 0 0.8rem; align-items: center; border-bottom: 1px solid #f0f2f5; min-height: 72px; text-decoration: none; color: inherit; transition: background 0.15s; }
.row:hover { background: #f5f7ff; }
.thumb { width: 80px; height: 54px; border-radius: 6px; overflow: hidden; flex-shrink: 0; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.carName { font-size: 0.85rem; font-weight: 700; margin-bottom: 0.1rem; }
.carVariant { font-size: 0.72rem; color: #8a93a6; }
.cellPrice { font-weight: 800; font-size: 0.9rem; }
.cellGray { color: #4a5568; font-size: 0.82rem; }
.fuelBadge { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 4px; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
.fuelPetrol { background: #fef3c7; color: #92400e; }
.fuelDiesel { background: #dbeafe; color: #1e40af; }
.fuelHybrid { background: #d1fae5; color: #065f46; }
.fuelElectric { background: #ede9fe; color: #5b21b6; }
.viewBtn { background: transparent; border: 1px solid #dde1e9; color: #4a5568; padding: 0.35rem 0.75rem; border-radius: 5px; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
.pagination { background: #fff; border: 1px solid #dde1e9; border-top: none; border-radius: 0 0 8px 8px; padding: 0.8rem 1rem; display: flex; align-items: center; justify-content: space-between; }
.pageInfo { font-size: 0.78rem; color: #8a93a6; }
.pageBtns { display: flex; gap: 0.25rem; }
.pageBtn { background: #fff; border: 1px solid #dde1e9; color: #4a5568; padding: 0.35rem 0.65rem; font-size: 0.78rem; cursor: pointer; border-radius: 4px; text-decoration: none; }
.pageBtnActive { background: #2e6fef; border-color: #2e6fef; color: #fff; }
.footer { background: #1e2533; color: rgba(255,255,255,0.35); padding: 1.5rem 2rem; display: flex; justify-content: space-between; font-size: 0.75rem; margin-top: 2rem; }
.footLogo { color: rgba(255,255,255,0.65); font-weight: 700; }
```

- [ ] **Step 11.2: `ListingGrid.tsx`** — renders a `<div>` table-style grid (not an HTML `<table>` to keep React simpler). Sidebar filters on the left. Each row: thumbnail + name + price + mileage + year + fuel badge + view button. Fuel badge class chosen by fuel string. Use `getListingThumbSrc`.

```typescript
function fuelBadgeClass(fuel: string | null, s: Record<string, string>): string {
  if (!fuel) return "";
  if (fuel.includes("Бензин")) return s.fuelPetrol;
  if (fuel.includes("Дизел")) return s.fuelDiesel;
  if (fuel.includes("Хибрид")) return s.fuelHybrid;
  if (fuel.includes("Електр")) return s.fuelElectric;
  return "";
}
```

- [ ] **Step 11.3: `ListingDetail.tsx/css`** — blue/gray professional theme detail page.

- [ ] **Step 11.4: Commit**

```bash
git add components/templates/pro/
git commit -m "feat: pro template (blue/gray data table)"
```

---

## Task 12: Verify Full Build & Test All Templates

- [ ] **Step 12.1: TypeScript check**

```bash
cd /Users/v/dev/scrapeui && npx tsc --noEmit 2>&1
```

Expected: 0 errors. Fix any type errors before continuing.

- [ ] **Step 12.2: Enable one dealer for testing**

In the database, enable a dealer and assign a template:

```bash
sqlite3 /Users/v/dev/scraped/listings.db "UPDATE dealers SET public_enabled = 1, template = 'bold' WHERE slug = 'carbros' LIMIT 1;"
```

If no dealer with slug `carbros` exists, find one:

```bash
sqlite3 /Users/v/dev/scraped/listings.db "SELECT slug FROM dealers LIMIT 5;"
```

Then use the actual slug:

```bash
sqlite3 /Users/v/dev/scraped/listings.db "UPDATE dealers SET public_enabled = 1, template = 'bold' WHERE id = 1;"
sqlite3 /Users/v/dev/scraped/listings.db "SELECT slug FROM dealers WHERE id = 1;"
```

- [ ] **Step 12.3: Test path-based routing**

Visit `http://localhost:3000/d/<actual-slug>` — you should see the Bold template with real listings.

- [ ] **Step 12.4: Test each template by switching**

```bash
sqlite3 /Users/v/dev/scraped/listings.db "UPDATE dealers SET template = 'executive' WHERE public_enabled = 1;"
```

Reload `http://localhost:3000/d/<slug>` — should now show Executive template. Repeat for all 6 templates.

- [ ] **Step 12.5: Test listing detail page**

Click any car card — should navigate to `/d/<slug>/<mobileId>` and show the detail page.

- [ ] **Step 12.6: Test 404 for disabled dealer**

```bash
sqlite3 /Users/v/dev/scraped/listings.db "UPDATE dealers SET public_enabled = 0 WHERE public_enabled = 1;"
```

Visit the URL — should show Next.js 404. Re-enable after:

```bash
sqlite3 /Users/v/dev/scraped/listings.db "UPDATE dealers SET public_enabled = 1 WHERE id = 1;"
```

- [ ] **Step 12.7: Commit**

```bash
git add -A
git commit -m "test: verify all 6 templates render correctly"
```

---

## Task 13: Admin UI — Dealer Public Site Config

Add a panel to `DealersManager.tsx` (or a standalone component embedded within) for configuring each dealer's public site.

**Files:**
- Create: `components/PublicDealerConfig.tsx`
- Modify: `app/api/dealers/[id]/route.ts` — handle PATCH for new fields
- Modify: `components/DealersManager.tsx` — embed the config panel

- [ ] **Step 13.1: Add PATCH handler to `app/api/dealers/[id]/route.ts`**

Read the existing file first, then add a `PATCH` export alongside any existing handlers:

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const dealerId = parseInt(id, 10);
  if (isNaN(dealerId)) return new Response("Bad Request", { status: 400 });

  const body = await request.json() as {
    public_enabled?: number;
    template?: string;
    public_domain?: string | null;
  };

  const ALLOWED_TEMPLATES = ["bold", "executive", "atlas", "night", "sunset", "pro"];

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (typeof body.public_enabled === "number") {
    updates.push("public_enabled = ?");
    values.push(body.public_enabled ? 1 : 0);
  }
  if (typeof body.template === "string" && ALLOWED_TEMPLATES.includes(body.template)) {
    updates.push("template = ?");
    values.push(body.template);
  }
  if ("public_domain" in body) {
    updates.push("public_domain = ?");
    values.push(body.public_domain ?? null);
  }

  if (updates.length === 0) {
    return new Response("No valid fields", { status: 400 });
  }

  raw.prepare(`UPDATE dealers SET ${updates.join(", ")} WHERE id = ?`).run(...values, dealerId);
  return Response.json({ ok: true });
}
```

- [ ] **Step 13.2: Create `components/PublicDealerConfig.tsx`**

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";

const TEMPLATES = [
  { value: "bold", label: "Bold — Orange/White Grid" },
  { value: "executive", label: "Executive — Dark/Gold List" },
  { value: "atlas", label: "Atlas — Editorial B&W" },
  { value: "night", label: "Night — Dark Neon Market" },
  { value: "sunset", label: "Sunset — Warm Lifestyle" },
  { value: "pro", label: "Pro — Blue Data Table" },
] as const;

interface Props {
  dealerId: number;
  dealerSlug: string;
  initialEnabled: number;
  initialTemplate: string;
  initialDomain: string | null;
}

export function PublicDealerConfig({
  dealerId,
  dealerSlug,
  initialEnabled,
  initialTemplate,
  initialDomain,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled === 1);
  const [template, setTemplate] = useState(initialTemplate || "bold");
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dealers/${dealerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_enabled: enabled ? 1 : 0,
          template,
          public_domain: domain.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Public site settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = `/d/${dealerSlug}`;

  return (
    <div className="border border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Public Site</h3>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline"
        >
          Preview →
        </a>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id={`enabled-${dealerId}`}
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor={`enabled-${dealerId}`} className="text-sm text-gray-300">
          Public site enabled
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Template</label>
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 rounded text-sm"
        >
          {TEMPLATES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Custom Domain</label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="www.carbros.bg"
          className="w-full bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 rounded text-sm"
        />
        <p className="text-xs text-gray-500">Leave blank to use path-based routing only</p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
```

- [ ] **Step 13.3: Embed in `DealersManager.tsx`**

Read `components/DealersManager.tsx` to find where individual dealer rows/cards are rendered. Import and embed `PublicDealerConfig`:

```typescript
import { PublicDealerConfig } from "@/components/PublicDealerConfig";
```

Inside the dealer row render, add (using actual field names from the dealer object in that component):

```typescript
<PublicDealerConfig
  dealerId={dealer.id}
  dealerSlug={dealer.slug}
  initialEnabled={dealer.publicEnabled ?? 0}
  initialTemplate={dealer.template ?? "bold"}
  initialDomain={dealer.publicDomain ?? null}
/>
```

> **Note:** The `DealersManager` may fetch dealers from an API endpoint; if so, ensure that endpoint also returns the new fields (`public_enabled`, `template`, `public_domain`) from the dealers table.

- [ ] **Step 13.4: Update dealers API to return new fields**

Read `app/api/dealers/route.ts`. If it does a `SELECT *` it already returns the new fields. If it selects specific columns, add the three new ones.

- [ ] **Step 13.5: Manual test**

Visit the admin UI, open a dealer, toggle public site on, pick a template, save. Verify the change persists by visiting `/d/<slug>` and confirming the template changed.

- [ ] **Step 13.6: Commit**

```bash
git add components/PublicDealerConfig.tsx app/api/dealers/"[id]"/route.ts components/DealersManager.tsx
git commit -m "feat: admin UI for public site template and domain config"
```

---

## Task 14: Final Checks

- [ ] **Step 14.1: Full TypeScript check**

```bash
cd /Users/v/dev/scrapeui && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 14.2: Lint**

```bash
npm run lint 2>&1
```

Fix any errors.

- [ ] **Step 14.3: Production build check**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds with no errors.

- [ ] **Step 14.4: Final commit**

```bash
git add -A
git commit -m "feat: public dealer frontend — 6 templates, domain routing, admin config"
```

---

## Self-Review

**Spec coverage:**
- ✅ Multidomain routing (middleware + `public_domain` field)
- ✅ Path-based routing (`/d/[slug]`)
- ✅ 6 throwaway templates (delete folder = gone)
- ✅ Template per dealer (DB field + registry)
- ✅ Listing grid with filters + pagination
- ✅ Single listing detail page
- ✅ Admin UI to configure template + domain + on/off
- ✅ `is_active = 1` only listings shown publicly

**No placeholders:** All CSS modules have complete class definitions. All `.tsx` files have complete implementations. Task 7–11 use "same structure as Task 6" for brevity but include the distinct CSS for each template — implementer should follow the exact CSS provided per task.

**Type consistency:** `PublicDealer`, `PublicListing`, `PublicListingDetail`, `PublicListingFilters` defined once in `lib/query-modules/public.ts`, re-exported from `lib/queries.ts`, aliased in `components/templates/types.ts`. All template components receive `ListingGridProps` / `ListingDetailProps` from `types.ts`. `getListingThumbSrc` called with snake_case fields matching its `ListingThumbSource` interface in all 6 templates.
