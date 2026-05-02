# Template Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Craft.js-powered inline template editor so dealers can visually customize their public listing pages, with configs stored in a new `dealer_template_configs` table and a lightweight public renderer that doesn't load Craft.js.

**Architecture:** New `dealer_template_configs` table stores Craft.js JSON per dealer. Editor lives at `app/(app)/templates/` (protected). Public pages check `dealers.active_template_config_id` — if set, a recursive `renderCraftNode` renderer in `lib/template-renderer.ts` handles it; otherwise falls back to the existing `TEMPLATE_REGISTRY`. Craft.js is only imported in editor routes.

**Tech Stack:** Next.js App Router, @craftjs/core v0.2.12, better-sqlite3, React 19, shadcn/ui, TypeScript strict

---

## File Map

**Create:**
- `scripts/migrations/add-template-configs.sql` — DB migration
- `lib/query-modules/dealer-templates.ts` — CRUD queries for dealer_template_configs
- `scripts/seed-base-templates.ts` — seed 6 base template rows
- `app/api/dealer-templates/route.ts` — GET list + POST create
- `app/api/dealer-templates/[id]/route.ts` — PATCH save
- `app/api/dealer-templates/[id]/fork/route.ts` — POST fork
- `app/api/dealer-templates/[id]/activate/route.ts` — POST activate
- `app/api/dealer-templates/[id]/delete/route.ts` — DELETE (use POST to avoid method conflicts)
- `app/(app)/templates/page.tsx` — config list UI
- `app/(app)/templates/editor/[configId]/page.tsx` — editor shell (server)
- `app/(app)/templates/editor/[configId]/EditorClient.tsx` — Craft.js editor (client)
- `components/editor-blocks/index.ts` — block resolver map
- `components/editor-blocks/generic/Section.tsx`
- `components/editor-blocks/generic/Text.tsx`
- `components/editor-blocks/generic/ImageBlock.tsx`
- `components/editor-blocks/generic/ButtonBlock.tsx`
- `components/editor-blocks/generic/Divider.tsx`
- `components/editor-blocks/generic/Spacer.tsx`
- `components/editor-blocks/listing-grid/HeroBanner.tsx`
- `components/editor-blocks/listing-grid/FilterBar.tsx`
- `components/editor-blocks/listing-grid/ListingGridBlock.tsx`
- `components/editor-blocks/listing-grid/Pagination.tsx`
- `components/editor-blocks/listing-grid/FooterBlock.tsx`
- `components/editor-blocks/listing-detail/ImageGallery.tsx`
- `components/editor-blocks/listing-detail/PriceTag.tsx`
- `components/editor-blocks/listing-detail/SpecsTable.tsx`
- `components/editor-blocks/listing-detail/Description.tsx`
- `components/editor-blocks/listing-detail/CTASection.tsx`
- `components/editor-blocks/listing-detail/RelatedListings.tsx`
- `lib/default-craft-state.ts` — minimal Craft.js state for new configs
- `lib/template-renderer.ts` — renderCraftNode + BLOCK_RENDERER_REGISTRY

**Modify:**
- `db/schema.ts` — add users.dealerId, new dealerTemplateConfigs table, dealers.activeTemplateConfigId
- `lib/auth.ts` — pass dealerId through JWT
- `lib/auth.config.ts` — include dealerId in session
- `lib/queries.ts` — re-export dealer-template query functions
- `lib/query-modules/public.ts` — add activeTemplateConfigId to PublicDealer, update getPublicDealer query
- `app/(public)/d/[slug]/page.tsx` — use renderer when active config present
- `app/(public)/d/[slug]/[mobileId]/page.tsx` — same for detail
- `components/AppSidebar.tsx` — add Templates nav link

---

## Task 1: DB Migration

**Files:**
- Create: `scripts/migrations/add-template-configs.sql`
- Modify: `db/schema.ts`

- [ ] **Step 1.1: Write migration SQL**

Create `scripts/migrations/add-template-configs.sql`:

```sql
-- Add dealer_id FK to users (nullable; null = admin)
ALTER TABLE users ADD COLUMN dealer_id INTEGER REFERENCES dealers(id);

-- Template configs table
CREATE TABLE dealer_template_configs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id        INTEGER REFERENCES dealers(id) ON DELETE CASCADE,
  base_template_id INTEGER REFERENCES dealer_template_configs(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  config_json      TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- Active config pointer on dealers
ALTER TABLE dealers ADD COLUMN active_template_config_id INTEGER
  REFERENCES dealer_template_configs(id) ON DELETE SET NULL;
```

- [ ] **Step 1.2: Apply migration**

```bash
sqlite3 /Users/v/dev/scraped/listings.db < scripts/migrations/add-template-configs.sql
```

Verify:
```bash
sqlite3 /Users/v/dev/scraped/listings.db "PRAGMA table_info(users); PRAGMA table_info(dealers); SELECT name FROM sqlite_master WHERE type='table' AND name='dealer_template_configs';"
```

Expected: `dealer_id` in users output, `active_template_config_id` in dealers output, `dealer_template_configs` row in table list.

- [ ] **Step 1.3: Update Drizzle schema**

In `db/schema.ts`, add to the `users` table definition after `createdAt`:
```typescript
  dealerId: integer("dealer_id").references(() => dealers.id),
```

After the `users` table export, add:
```typescript
export const dealerTemplateConfigs = sqliteTable("dealer_template_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id").references(() => dealers.id),
  baseTemplateId: integer("base_template_id"),
  name: text("name").notNull(),
  configJson: text("config_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

In the `dealers` table, add after `publicEnabled`:
```typescript
  activeTemplateConfigId: integer("active_template_config_id"),
```

- [ ] **Step 1.4: Commit**

```bash
git add scripts/migrations/add-template-configs.sql db/schema.ts
git commit -m "feat: add dealer_template_configs table and FK columns"
```

---

## Task 2: Auth — dealer_id in JWT and Session

**Files:**
- Modify: `lib/auth.ts`
- Modify: `lib/auth.config.ts`

- [ ] **Step 2.1: Extend type declarations in `lib/auth.ts`**

Replace the existing module declarations at the top of `lib/auth.ts` with:

```typescript
declare module 'next-auth' {
  interface User {
    role?: string;
    username?: string;
    dealerId?: number | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      role: string;
      dealerId: number | null;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: string;
    username: string;
    dealerId: number | null;
  }
}
```

- [ ] **Step 2.2: Read dealer_id from DB and pass through authorize**

In `lib/auth.ts`, update the SELECT query inside `authorize` to also fetch `dealer_id`:

```typescript
// Both SELECT statements — change to:
'SELECT id, username, name, password_hash, role, dealer_id FROM users WHERE role = \'admin\' LIMIT 1'
// and:
'SELECT id, username, name, password_hash, role, dealer_id FROM users WHERE username = ?'
```

Change the type annotation on `user` in both branches:
```typescript
| { id: number; username: string; name: string; password_hash: string; role: string; dealer_id: number | null }
```

Change the return value in `authorize`:
```typescript
return {
  id: String(user.id),
  name: user.name,
  username: user.username,
  role: user.role,
  dealerId: user.dealer_id ?? null,
};
```

- [ ] **Step 2.3: Thread dealerId through JWT and session callbacks in `lib/auth.config.ts`**

Update the `jwt` callback:
```typescript
jwt({ token, user }) {
  if (user) {
    token.id = user.id!;
    token.role = (user as { role?: string }).role ?? 'user';
    token.username = (user as { username?: string }).username ?? '';
    token.dealerId = (user as { dealerId?: number | null }).dealerId ?? null;
  }
  return token;
},
```

Update the `session` callback:
```typescript
session({ session, token }) {
  session.user.id = token.id as string;
  (session.user as unknown as Record<string, unknown>).role = token.role;
  (session.user as unknown as Record<string, unknown>).username = token.username;
  (session.user as unknown as Record<string, unknown>).dealerId = token.dealerId ?? null;
  return session;
},
```

- [ ] **Step 2.4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to auth types.

- [ ] **Step 2.5: Commit**

```bash
git add lib/auth.ts lib/auth.config.ts
git commit -m "feat: add dealerId to JWT and session"
```

---

## Task 3: Query Functions for dealer_template_configs

**Files:**
- Create: `lib/query-modules/dealer-templates.ts`
- Modify: `lib/queries.ts`

- [ ] **Step 3.1: Create `lib/query-modules/dealer-templates.ts`**

```typescript
import { raw } from "@/db/client";

export interface DealerTemplateConfig {
  id: number;
  dealerId: number | null;
  baseTemplateId: number | null;
  name: string;
  configJson: string;
  createdAt: string;
  updatedAt: string;
}

export function listDealerTemplateConfigs(dealerId: number): DealerTemplateConfig[] {
  // Include base templates (dealer_id IS NULL) plus this dealer's own configs
  return raw
    .prepare(
      `SELECT id, dealer_id as dealerId, base_template_id as baseTemplateId,
              name, config_json as configJson, created_at as createdAt, updated_at as updatedAt
       FROM dealer_template_configs
       WHERE dealer_id = ? OR dealer_id IS NULL
       ORDER BY dealer_id IS NULL DESC, created_at ASC`,
    )
    .all(dealerId) as DealerTemplateConfig[];
}

export function listAllDealerTemplateConfigs(): DealerTemplateConfig[] {
  return raw
    .prepare(
      `SELECT id, dealer_id as dealerId, base_template_id as baseTemplateId,
              name, config_json as configJson, created_at as createdAt, updated_at as updatedAt
       FROM dealer_template_configs
       ORDER BY dealer_id IS NULL DESC, dealer_id ASC, created_at ASC`,
    )
    .all() as DealerTemplateConfig[];
}

export function getDealerTemplateConfig(id: number): DealerTemplateConfig | null {
  const row = raw
    .prepare(
      `SELECT id, dealer_id as dealerId, base_template_id as baseTemplateId,
              name, config_json as configJson, created_at as createdAt, updated_at as updatedAt
       FROM dealer_template_configs WHERE id = ?`,
    )
    .get(id) as DealerTemplateConfig | undefined;
  return row ?? null;
}

export function getActiveDealerTemplateConfig(dealerId: number): DealerTemplateConfig | null {
  const row = raw
    .prepare(
      `SELECT dtc.id, dtc.dealer_id as dealerId, dtc.base_template_id as baseTemplateId,
              dtc.name, dtc.config_json as configJson,
              dtc.created_at as createdAt, dtc.updated_at as updatedAt
       FROM dealer_template_configs dtc
       JOIN dealers d ON d.active_template_config_id = dtc.id
       WHERE d.id = ?
       LIMIT 1`,
    )
    .get(dealerId) as DealerTemplateConfig | undefined;
  return row ?? null;
}

export function createDealerTemplateConfig(params: {
  dealerId: number;
  baseTemplateId: number | null;
  name: string;
  configJson: string;
}): number {
  const now = new Date().toISOString();
  const result = raw
    .prepare(
      `INSERT INTO dealer_template_configs (dealer_id, base_template_id, name, config_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(params.dealerId, params.baseTemplateId, params.name, params.configJson, now, now);
  return result.lastInsertRowid as number;
}

export function updateDealerTemplateConfig(
  id: number,
  fields: { name?: string; configJson?: string },
): void {
  const now = new Date().toISOString();
  if (fields.name !== undefined && fields.configJson !== undefined) {
    raw
      .prepare(
        `UPDATE dealer_template_configs SET name = ?, config_json = ?, updated_at = ? WHERE id = ?`,
      )
      .run(fields.name, fields.configJson, now, id);
  } else if (fields.name !== undefined) {
    raw
      .prepare(`UPDATE dealer_template_configs SET name = ?, updated_at = ? WHERE id = ?`)
      .run(fields.name, now, id);
  } else if (fields.configJson !== undefined) {
    raw
      .prepare(`UPDATE dealer_template_configs SET config_json = ?, updated_at = ? WHERE id = ?`)
      .run(fields.configJson, now, id);
  }
}

export function forkDealerTemplateConfig(sourceId: number, newName: string): number {
  const source = getDealerTemplateConfig(sourceId);
  if (!source) throw new Error(`Config ${sourceId} not found`);
  if (source.dealerId === null) throw new Error("Cannot fork a base template — create from base instead");
  return createDealerTemplateConfig({
    dealerId: source.dealerId,
    baseTemplateId: sourceId,
    name: newName,
    configJson: source.configJson,
  });
}

export function activateDealerTemplateConfig(configId: number, dealerId: number): void {
  raw
    .prepare(`UPDATE dealers SET active_template_config_id = ? WHERE id = ?`)
    .run(configId, dealerId);
}

export function deleteDealerTemplateConfig(id: number): void {
  // Check not active anywhere
  const inUse = raw
    .prepare(`SELECT id FROM dealers WHERE active_template_config_id = ? LIMIT 1`)
    .get(id);
  if (inUse) throw new Error("Cannot delete an active template config");
  raw.prepare(`DELETE FROM dealer_template_configs WHERE id = ?`).run(id);
}
```

- [ ] **Step 3.2: Re-export from `lib/queries.ts`**

Add at the bottom of `lib/queries.ts`:

```typescript
export {
  listDealerTemplateConfigs,
  listAllDealerTemplateConfigs,
  getDealerTemplateConfig,
  getActiveDealerTemplateConfig,
  createDealerTemplateConfig,
  updateDealerTemplateConfig,
  forkDealerTemplateConfig,
  activateDealerTemplateConfig,
  deleteDealerTemplateConfig,
} from "./query-modules/dealer-templates";
export type { DealerTemplateConfig } from "./query-modules/dealer-templates";
```

- [ ] **Step 3.3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3.4: Commit**

```bash
git add lib/query-modules/dealer-templates.ts lib/queries.ts
git commit -m "feat: add dealer template config query functions"
```

---

## Task 4: Seed Base Templates

**Files:**
- Create: `scripts/seed-base-templates.ts`

- [ ] **Step 4.1: Create `lib/default-craft-state.ts`**

```typescript
// Minimal Craft.js serialized state — empty canvas with one Section root.
// Both listingGrid and listingDetail start from this structure.
export const EMPTY_CRAFT_STATE = JSON.stringify({
  ROOT: {
    type: { resolvedName: "Section" },
    isCanvas: true,
    props: { backgroundColor: "#ffffff", padding: 24, maxWidth: 1200 },
    displayName: "Section",
    custom: {},
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
});

export const DEFAULT_CONFIG_JSON = JSON.stringify({
  listingGrid: JSON.parse(EMPTY_CRAFT_STATE),
  listingDetail: JSON.parse(EMPTY_CRAFT_STATE),
});
```

- [ ] **Step 4.2: Create `scripts/seed-base-templates.ts`**

```typescript
import Database from "better-sqlite3";
import { DEFAULT_CONFIG_JSON } from "../lib/default-craft-state";

const db = new Database("/Users/v/dev/scraped/listings.db");
const now = new Date().toISOString();

const BASE_TEMPLATES = [
  { name: "Bold" },
  { name: "Executive" },
  { name: "Atlas" },
  { name: "Night" },
  { name: "Sunset" },
  { name: "Pro" },
];

const insert = db.prepare(
  `INSERT OR IGNORE INTO dealer_template_configs
     (dealer_id, base_template_id, name, config_json, created_at, updated_at)
   VALUES (NULL, NULL, ?, ?, ?, ?)`,
);

const insertMany = db.transaction((templates: typeof BASE_TEMPLATES) => {
  for (const t of templates) {
    insert.run(t.name, DEFAULT_CONFIG_JSON, now, now);
  }
});

insertMany(BASE_TEMPLATES);

const rows = db.prepare("SELECT id, name FROM dealer_template_configs WHERE dealer_id IS NULL").all();
console.log("Base templates seeded:");
console.table(rows);
db.close();
```

- [ ] **Step 4.3: Run seed script**

```bash
npx tsx scripts/seed-base-templates.ts
```

Expected output: table showing 6 rows (Bold, Executive, Atlas, Night, Sunset, Pro) each with an id.

- [ ] **Step 4.4: Commit**

```bash
git add lib/default-craft-state.ts scripts/seed-base-templates.ts
git commit -m "feat: add default Craft.js state and base template seed script"
```

---

## Task 5: API Routes

**Files:**
- Create: `app/api/dealer-templates/route.ts`
- Create: `app/api/dealer-templates/[id]/route.ts`
- Create: `app/api/dealer-templates/[id]/fork/route.ts`
- Create: `app/api/dealer-templates/[id]/activate/route.ts`
- Create: `app/api/dealer-templates/[id]/delete/route.ts`

- [ ] **Step 5.1: Create `app/api/dealer-templates/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import {
  listDealerTemplateConfigs,
  listAllDealerTemplateConfigs,
  createDealerTemplateConfig,
  getDealerTemplateConfig,
} from "@/lib/queries";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const dealerIdParam = url.searchParams.get("dealerId");

  const isAdmin = (session.user as { role: string }).role === "admin";

  if (isAdmin && !dealerIdParam) {
    return Response.json(listAllDealerTemplateConfigs());
  }

  const dealerId = dealerIdParam ? parseInt(dealerIdParam, 10) : null;
  if (!dealerId || isNaN(dealerId)) {
    return Response.json({ error: "dealerId required" }, { status: 400 });
  }

  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && sessionDealerId !== dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(listDealerTemplateConfigs(dealerId));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = (session.user as { role: string }).role === "admin";
  const body = await request.json() as { dealerId: number; baseTemplateId: number; name: string };

  const { dealerId, baseTemplateId, name } = body;
  if (!dealerId || !baseTemplateId || !name?.trim()) {
    return Response.json({ error: "dealerId, baseTemplateId, and name are required" }, { status: 400 });
  }

  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && sessionDealerId !== dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const base = getDealerTemplateConfig(baseTemplateId);
  if (!base) return Response.json({ error: "Base template not found" }, { status: 404 });

  const { createDealerTemplateConfig: create } = await import("@/lib/queries");
  const id = create({ dealerId, baseTemplateId, name: name.trim(), configJson: base.configJson });

  return Response.json({ id }, { status: 201 });
}
```

- [ ] **Step 5.2: Create `app/api/dealer-templates/[id]/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import {
  getDealerTemplateConfig,
  updateDealerTemplateConfig,
} from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const configId = parseInt(id, 10);
  const config = getDealerTemplateConfig(configId);
  if (!config) return Response.json({ error: "Not found" }, { status: 404 });

  const isAdmin = (session.user as { role: string }).role === "admin";
  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && (config.dealerId === null || sessionDealerId !== config.dealerId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (config.dealerId === null) {
    return Response.json({ error: "Base templates are read-only" }, { status: 403 });
  }

  const body = await request.json() as { name?: string; configJson?: string };
  updateDealerTemplateConfig(configId, { name: body.name, configJson: body.configJson });

  return Response.json({ ok: true });
}
```

- [ ] **Step 5.3: Create `app/api/dealer-templates/[id]/fork/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { getDealerTemplateConfig, forkDealerTemplateConfig, createDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sourceId = parseInt(id, 10);
  const source = getDealerTemplateConfig(sourceId);
  if (!source) return Response.json({ error: "Not found" }, { status: 404 });

  const isAdmin = (session.user as { role: string }).role === "admin";
  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;

  const body = await request.json() as { name: string; dealerId?: number };
  if (!body.name?.trim()) return Response.json({ error: "name required" }, { status: 400 });

  // Forking a base template = create new config from base
  if (source.dealerId === null) {
    const targetDealerId = isAdmin ? body.dealerId : sessionDealerId;
    if (!targetDealerId) return Response.json({ error: "dealerId required" }, { status: 400 });
    if (!isAdmin && sessionDealerId !== targetDealerId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const newId = createDealerTemplateConfig({
      dealerId: targetDealerId,
      baseTemplateId: sourceId,
      name: body.name.trim(),
      configJson: source.configJson,
    });
    return Response.json({ id: newId }, { status: 201 });
  }

  // Forking a dealer config
  if (!isAdmin && sessionDealerId !== source.dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const newId = forkDealerTemplateConfig(sourceId, body.name.trim());
  return Response.json({ id: newId }, { status: 201 });
}
```

- [ ] **Step 5.4: Create `app/api/dealer-templates/[id]/activate/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { getDealerTemplateConfig, activateDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const configId = parseInt(id, 10);
  const config = getDealerTemplateConfig(configId);
  if (!config || config.dealerId === null) {
    return Response.json({ error: "Not found or base template" }, { status: 404 });
  }

  const isAdmin = (session.user as { role: string }).role === "admin";
  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && sessionDealerId !== config.dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  activateDealerTemplateConfig(configId, config.dealerId);
  return Response.json({ ok: true });
}
```

- [ ] **Step 5.5: Create `app/api/dealer-templates/[id]/delete/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { getDealerTemplateConfig, deleteDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const configId = parseInt(id, 10);
  const config = getDealerTemplateConfig(configId);
  if (!config) return Response.json({ error: "Not found" }, { status: 404 });

  if (config.dealerId === null) {
    return Response.json({ error: "Base templates cannot be deleted" }, { status: 403 });
  }

  const isAdmin = (session.user as { role: string }).role === "admin";
  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && sessionDealerId !== config.dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    deleteDealerTemplateConfig(configId);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 5.6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5.7: Commit**

```bash
git add app/api/dealer-templates/
git commit -m "feat: add dealer-templates API routes"
```

---

## Task 6: Install Craft.js

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 6.1: Install @craftjs/core**

```bash
npm install @craftjs/core
```

Expected: package added to `node_modules/@craftjs/core`, no peer dependency errors for React 19.

- [ ] **Step 6.2: Verify import works**

Create a temp file to check:
```bash
echo "import { Editor } from '@craftjs/core'; console.log(typeof Editor);" | npx tsx --input-type=module 2>&1 | head -5
```

Expected: `function` or no errors. If there are errors, run:
```bash
npm install @craftjs/core --legacy-peer-deps
```

- [ ] **Step 6.3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @craftjs/core"
```

---

## Task 7: Generic Block Components

**Files:**
- Create: `components/editor-blocks/generic/Section.tsx`
- Create: `components/editor-blocks/generic/Text.tsx`
- Create: `components/editor-blocks/generic/ImageBlock.tsx`
- Create: `components/editor-blocks/generic/ButtonBlock.tsx`
- Create: `components/editor-blocks/generic/Divider.tsx`
- Create: `components/editor-blocks/generic/Spacer.tsx`

- [ ] **Step 7.1: Create `components/editor-blocks/generic/Section.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface SectionProps {
  backgroundColor?: string;
  padding?: number;
  maxWidth?: number;
  children?: React.ReactNode;
}

export const Section: UserComponent<SectionProps> = ({
  backgroundColor = '#ffffff',
  padding = 24,
  maxWidth = 1200,
  children,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        backgroundColor,
        padding,
        maxWidth,
        margin: '0 auto',
        width: '100%',
        minHeight: 48,
      }}
    >
      {children}
    </div>
  );
};

Section.craft = {
  displayName: 'Section',
  props: { backgroundColor: '#ffffff', padding: 24, maxWidth: 1200 },
  rules: { canDrop: () => true },
};
```

- [ ] **Step 7.2: Create `components/editor-blocks/generic/Text.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface TextProps {
  content?: string;
  fontSize?: number;
  color?: string;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  as?: 'h1' | 'h2' | 'h3' | 'p';
}

export const Text: UserComponent<TextProps> = ({
  content = 'Text',
  fontSize = 16,
  color = '#1a1a1a',
  fontWeight = 'normal',
  textAlign = 'left',
  as: Tag = 'p',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <Tag
      ref={(ref) => ref && connect(drag(ref))}
      style={{ fontSize, color, fontWeight, textAlign, margin: 0 }}
    >
      {content}
    </Tag>
  );
};

Text.craft = {
  displayName: 'Text',
  props: { content: 'Text block', fontSize: 16, color: '#1a1a1a', fontWeight: 'normal', textAlign: 'left', as: 'p' },
};
```

- [ ] **Step 7.3: Create `components/editor-blocks/generic/ImageBlock.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface ImageBlockProps {
  src?: string;
  alt?: string;
  width?: string;
  alignment?: 'left' | 'center' | 'right';
  linkHref?: string;
}

export const ImageBlock: UserComponent<ImageBlockProps> = ({
  src = 'https://placehold.co/400x200',
  alt = '',
  width = '100%',
  alignment = 'left',
  linkHref,
}) => {
  const { connectors: { connect, drag } } = useNode();
  const img = <img src={src} alt={alt} style={{ width, display: 'block' }} />;
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{ textAlign: alignment }}
    >
      {linkHref ? <a href={linkHref}>{img}</a> : img}
    </div>
  );
};

ImageBlock.craft = {
  displayName: 'Image',
  props: { src: 'https://placehold.co/400x200', alt: '', width: '100%', alignment: 'left' },
};
```

- [ ] **Step 7.4: Create `components/editor-blocks/generic/ButtonBlock.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface ButtonBlockProps {
  label?: string;
  href?: string;
  backgroundColor?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: '8px 16px', md: '12px 24px', lg: '16px 32px' };

export const ButtonBlock: UserComponent<ButtonBlockProps> = ({
  label = 'Click here',
  href = '#',
  backgroundColor = '#2563eb',
  color = '#ffffff',
  size = 'md',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <a
      ref={(ref) => ref && connect(drag(ref))}
      href={href}
      style={{
        display: 'inline-block',
        backgroundColor,
        color,
        padding: SIZES[size],
        borderRadius: 6,
        textDecoration: 'none',
        fontWeight: 600,
      }}
    >
      {label}
    </a>
  );
};

ButtonBlock.craft = {
  displayName: 'Button',
  props: { label: 'Click here', href: '#', backgroundColor: '#2563eb', color: '#ffffff', size: 'md' },
};
```

- [ ] **Step 7.5: Create `components/editor-blocks/generic/Divider.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface DividerProps {
  color?: string;
  thickness?: number;
  marginY?: number;
}

export const Divider: UserComponent<DividerProps> = ({
  color = '#e5e7eb',
  thickness = 1,
  marginY = 16,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <hr
      ref={(ref) => ref && connect(drag(ref))}
      style={{ borderColor: color, borderWidth: thickness, borderStyle: 'solid', margin: `${marginY}px 0` }}
    />
  );
};

Divider.craft = { displayName: 'Divider', props: { color: '#e5e7eb', thickness: 1, marginY: 16 } };
```

- [ ] **Step 7.6: Create `components/editor-blocks/generic/Spacer.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface SpacerProps { height?: number }

export const Spacer: UserComponent<SpacerProps> = ({ height = 32 }) => {
  const { connectors: { connect, drag } } = useNode();
  return <div ref={(ref) => ref && connect(drag(ref))} style={{ height }} />;
};

Spacer.craft = { displayName: 'Spacer', props: { height: 32 } };
```

- [ ] **Step 7.7: Commit**

```bash
git add components/editor-blocks/generic/
git commit -m "feat: add generic editor blocks (Section, Text, Image, Button, Divider, Spacer)"
```

---

## Task 8: Domain-Specific Block Components

**Files:**
- Create: `components/editor-blocks/listing-grid/HeroBanner.tsx`
- Create: `components/editor-blocks/listing-grid/FilterBar.tsx`
- Create: `components/editor-blocks/listing-grid/ListingGridBlock.tsx`
- Create: `components/editor-blocks/listing-grid/Pagination.tsx`
- Create: `components/editor-blocks/listing-grid/FooterBlock.tsx`
- Create: `components/editor-blocks/listing-detail/ImageGallery.tsx`
- Create: `components/editor-blocks/listing-detail/PriceTag.tsx`
- Create: `components/editor-blocks/listing-detail/SpecsTable.tsx`
- Create: `components/editor-blocks/listing-detail/Description.tsx`
- Create: `components/editor-blocks/listing-detail/CTASection.tsx`
- Create: `components/editor-blocks/listing-detail/RelatedListings.tsx`

These blocks show placeholder UI in the editor canvas (they receive no live data in editor mode — live data is injected only at public render time).

- [ ] **Step 8.1: Create `components/editor-blocks/listing-grid/HeroBanner.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface HeroBannerProps {
  backgroundColor?: string;
  height?: number;
  showLogo?: boolean;
  tagline?: string;
  fontColor?: string;
}

export const HeroBanner: UserComponent<HeroBannerProps> = ({
  backgroundColor = '#1e293b',
  height = 200,
  showLogo = true,
  tagline = 'Quality Cars',
  fontColor = '#ffffff',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        backgroundColor,
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: fontColor,
      }}
    >
      {showLogo && (
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          🚗
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 24 }}>Dealer Name</div>
      {tagline && <div style={{ fontSize: 14, opacity: 0.8 }}>{tagline}</div>}
    </div>
  );
};

HeroBanner.craft = {
  displayName: 'Hero Banner',
  props: { backgroundColor: '#1e293b', height: 200, showLogo: true, tagline: 'Quality Cars', fontColor: '#ffffff' },
};
```

- [ ] **Step 8.2: Create `components/editor-blocks/listing-grid/FilterBar.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface FilterBarProps {
  showMake?: boolean;
  showModel?: boolean;
  showPrice?: boolean;
  showYear?: boolean;
  showFuel?: boolean;
  layout?: 'horizontal' | 'vertical';
  backgroundColor?: string;
}

export const FilterBar: UserComponent<FilterBarProps> = ({
  showMake = true,
  showModel = true,
  showPrice = true,
  showYear = true,
  showFuel = true,
  layout = 'horizontal',
  backgroundColor = '#f8fafc',
}) => {
  const { connectors: { connect, drag } } = useNode();
  const filters = [
    showMake && 'Make',
    showModel && 'Model',
    showPrice && 'Price',
    showYear && 'Year',
    showFuel && 'Fuel',
  ].filter(Boolean) as string[];

  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        backgroundColor,
        padding: '12px 16px',
        display: 'flex',
        flexDirection: layout === 'vertical' ? 'column' : 'row',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      {filters.map((f) => (
        <div
          key={f}
          style={{
            background: '#e2e8f0',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 13,
            color: '#475569',
          }}
        >
          {f} ▾
        </div>
      ))}
    </div>
  );
};

FilterBar.craft = {
  displayName: 'Filter Bar',
  props: { showMake: true, showModel: true, showPrice: true, showYear: true, showFuel: true, layout: 'horizontal', backgroundColor: '#f8fafc' },
};
```

- [ ] **Step 8.3: Create `components/editor-blocks/listing-grid/ListingGridBlock.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface ListingGridBlockProps {
  columns?: 2 | 3 | 4;
  cardStyle?: 'card' | 'minimal';
  gap?: number;
  showPrice?: boolean;
  showMileage?: boolean;
  showYear?: boolean;
  showFuel?: boolean;
}

const PLACEHOLDER_CARDS = Array.from({ length: 6 }, (_, i) => i);

export const ListingGridBlock: UserComponent<ListingGridBlockProps> = ({
  columns = 3,
  cardStyle = 'card',
  gap = 16,
  showPrice = true,
  showMileage = true,
  showYear = true,
  showFuel = true,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        padding: 16,
      }}
    >
      {PLACEHOLDER_CARDS.map((i) => (
        <div
          key={i}
          style={{
            borderRadius: cardStyle === 'card' ? 8 : 0,
            border: cardStyle === 'card' ? '1px solid #e2e8f0' : 'none',
            overflow: 'hidden',
            background: cardStyle === 'card' ? '#fff' : 'transparent',
          }}
        >
          <div style={{ height: 140, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
            📷 Photo
          </div>
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Make Model Year</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
              {showPrice && <span>€12 500</span>}
              {showYear && <span>2020</span>}
              {showMileage && <span>95 000 km</span>}
              {showFuel && <span>Diesel</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

ListingGridBlock.craft = {
  displayName: 'Listing Grid',
  props: { columns: 3, cardStyle: 'card', gap: 16, showPrice: true, showMileage: true, showYear: true, showFuel: true },
};
```

- [ ] **Step 8.4: Create `components/editor-blocks/listing-grid/Pagination.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface PaginationProps {
  style?: 'numbered' | 'prev-next' | 'load-more';
  color?: string;
}

export const Pagination: UserComponent<PaginationProps> = ({
  style: pStyle = 'numbered',
  color = '#2563eb',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}
    >
      {pStyle === 'numbered' && [1, 2, 3, 4, 5].map((n) => (
        <div key={n} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: n === 1 ? color : '#f1f5f9', color: n === 1 ? '#fff' : '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{n}</div>
      ))}
      {pStyle === 'prev-next' && (
        <>
          <div style={{ padding: '6px 16px', border: `1px solid ${color}`, borderRadius: 6, color, cursor: 'pointer', fontSize: 13 }}>← Previous</div>
          <div style={{ padding: '6px 16px', background: color, borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 }}>Next →</div>
        </>
      )}
      {pStyle === 'load-more' && (
        <div style={{ padding: '10px 32px', background: color, borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Load More</div>
      )}
    </div>
  );
};

Pagination.craft = { displayName: 'Pagination', props: { style: 'numbered', color: '#2563eb' } };
```

- [ ] **Step 8.5: Create `components/editor-blocks/listing-grid/FooterBlock.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface FooterBlockProps {
  backgroundColor?: string;
  fontColor?: string;
  showAddress?: boolean;
  showPhone?: boolean;
  showEmail?: boolean;
}

export const FooterBlock: UserComponent<FooterBlockProps> = ({
  backgroundColor = '#1e293b',
  fontColor = '#cbd5e1',
  showAddress = true,
  showPhone = true,
  showEmail = true,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <footer
      ref={(ref) => ref && connect(drag(ref))}
      style={{ backgroundColor, color: fontColor, padding: '24px 32px', display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'space-between', fontSize: 13 }}
    >
      <div style={{ fontWeight: 600, fontSize: 16 }}>Dealer Name</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {showAddress && <span>📍 123 Main Street, City</span>}
        {showPhone && <span>📞 +1 234 567 890</span>}
        {showEmail && <span>✉️ dealer@example.com</span>}
      </div>
    </footer>
  );
};

FooterBlock.craft = {
  displayName: 'Footer',
  props: { backgroundColor: '#1e293b', fontColor: '#cbd5e1', showAddress: true, showPhone: true, showEmail: true },
};
```

- [ ] **Step 8.6: Create `components/editor-blocks/listing-detail/ImageGallery.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface ImageGalleryProps {
  layout?: 'slider' | 'grid' | 'filmstrip';
  maxHeight?: number;
}

export const ImageGallery: UserComponent<ImageGalleryProps> = ({
  layout = 'slider',
  maxHeight = 400,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(ref) => ref && connect(drag(ref))} style={{ width: '100%' }}>
      {layout === 'slider' && (
        <div style={{ height: maxHeight, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#94a3b8', gap: 16 }}>
          <span style={{ fontSize: 20, cursor: 'pointer' }}>‹</span>
          📷 Main Photo
          <span style={{ fontSize: 20, cursor: 'pointer' }}>›</span>
        </div>
      )}
      {layout === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: 120, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>📷</div>
          ))}
        </div>
      )}
      {layout === 'filmstrip' && (
        <div>
          <div style={{ height: maxHeight * 0.75, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#94a3b8' }}>📷 Main Photo</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ flex: 1, height: 60, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11 }}>📷</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

ImageGallery.craft = { displayName: 'Image Gallery', props: { layout: 'slider', maxHeight: 400 } };
```

- [ ] **Step 8.7: Create `components/editor-blocks/listing-detail/PriceTag.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface PriceTagProps {
  showVat?: boolean;
  fontSize?: number;
  color?: string;
}

export const PriceTag: UserComponent<PriceTagProps> = ({
  showVat = true,
  fontSize = 32,
  color = '#1e293b',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(ref) => ref && connect(drag(ref))} style={{ padding: '12px 0' }}>
      <div style={{ fontSize, fontWeight: 700, color }}>€12 500</div>
      {showVat && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>incl. VAT (€10 504 excl.)</div>}
    </div>
  );
};

PriceTag.craft = { displayName: 'Price Tag', props: { showVat: true, fontSize: 32, color: '#1e293b' } };
```

- [ ] **Step 8.8: Create `components/editor-blocks/listing-detail/SpecsTable.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface SpecsTableProps {
  showMileage?: boolean;
  showFuel?: boolean;
  showPower?: boolean;
  showTransmission?: boolean;
  showYear?: boolean;
  layout?: 'table' | 'cards';
}

const PLACEHOLDER_SPECS = [
  { key: 'mileage', label: 'Mileage', value: '95 000 km' },
  { key: 'fuel', label: 'Fuel', value: 'Diesel' },
  { key: 'power', label: 'Power', value: '140 kW' },
  { key: 'transmission', label: 'Transmission', value: 'Automatic' },
  { key: 'year', label: 'Year', value: '2020' },
];

export const SpecsTable: UserComponent<SpecsTableProps> = ({
  showMileage = true,
  showFuel = true,
  showPower = true,
  showTransmission = true,
  showYear = true,
  layout = 'table',
}) => {
  const { connectors: { connect, drag } } = useNode();
  const visMap: Record<string, boolean> = { mileage: showMileage, fuel: showFuel, power: showPower, transmission: showTransmission, year: showYear };
  const visible = PLACEHOLDER_SPECS.filter((s) => visMap[s.key]);

  return (
    <div ref={(ref) => ref && connect(drag(ref))} style={{ padding: '8px 0' }}>
      {layout === 'table' ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            {visible.map((s) => (
              <tr key={s.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 0', color: '#64748b', width: '40%' }}>{s.label}</td>
                <td style={{ padding: '8px 0', fontWeight: 600 }}>{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {visible.map((s) => (
            <div key={s.key} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

SpecsTable.craft = {
  displayName: 'Specs Table',
  props: { showMileage: true, showFuel: true, showPower: true, showTransmission: true, showYear: true, layout: 'table' },
};
```

- [ ] **Step 8.9: Create `components/editor-blocks/listing-detail/Description.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface DescriptionProps {
  fontSize?: number;
  color?: string;
  maxHeight?: number;
  truncate?: boolean;
}

export const Description: UserComponent<DescriptionProps> = ({
  fontSize = 15,
  color = '#334155',
  maxHeight = 200,
  truncate = true,
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        fontSize,
        color,
        lineHeight: 1.6,
        maxHeight: truncate ? maxHeight : undefined,
        overflow: truncate ? 'hidden' : undefined,
        position: 'relative',
        padding: '8px 0',
      }}
    >
      <p style={{ margin: 0 }}>
        This is a placeholder listing description. The actual description text will be loaded from the listing data when the public page is rendered. Dealers can configure font size, color, and whether the text is truncated with a "Read more" button.
      </p>
      {truncate && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(transparent, white)', display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ color: '#2563eb', fontSize: 13, fontWeight: 600 }}>Read more ↓</span>
        </div>
      )}
    </div>
  );
};

Description.craft = { displayName: 'Description', props: { fontSize: 15, color: '#334155', maxHeight: 200, truncate: true } };
```

- [ ] **Step 8.10: Create `components/editor-blocks/listing-detail/CTASection.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface CTASectionProps {
  showPhone?: boolean;
  showEmail?: boolean;
  showWhatsapp?: boolean;
  buttonColor?: string;
  layout?: 'row' | 'column';
}

export const CTASection: UserComponent<CTASectionProps> = ({
  showPhone = true,
  showEmail = true,
  showWhatsapp = true,
  buttonColor = '#2563eb',
  layout = 'row',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{ display: 'flex', flexDirection: layout === 'column' ? 'column' : 'row', gap: 12, padding: '16px 0', flexWrap: 'wrap' }}
    >
      {showPhone && (
        <div style={{ padding: '12px 24px', background: buttonColor, color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>📞 Call</div>
      )}
      {showEmail && (
        <div style={{ padding: '12px 24px', background: '#fff', color: buttonColor, border: `2px solid ${buttonColor}`, borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>✉️ Email</div>
      )}
      {showWhatsapp && (
        <div style={{ padding: '12px 24px', background: '#25d366', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>WhatsApp</div>
      )}
    </div>
  );
};

CTASection.craft = {
  displayName: 'CTA Section',
  props: { showPhone: true, showEmail: true, showWhatsapp: true, buttonColor: '#2563eb', layout: 'row' },
};
```

- [ ] **Step 8.11: Create `components/editor-blocks/listing-detail/RelatedListings.tsx`**

```typescript
'use client';
import { useNode, type UserComponent } from '@craftjs/core';

interface RelatedListingsProps {
  count?: 3 | 4 | 6;
  cardStyle?: 'card' | 'minimal';
}

export const RelatedListings: UserComponent<RelatedListingsProps> = ({
  count = 3,
  cardStyle = 'card',
}) => {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(ref) => ref && connect(drag(ref))} style={{ padding: '16px 0' }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Similar Cars</h3>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 12 }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={{ borderRadius: cardStyle === 'card' ? 8 : 0, border: cardStyle === 'card' ? '1px solid #e2e8f0' : 'none', overflow: 'hidden' }}>
            <div style={{ height: 100, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>📷</div>
            <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>Similar Car {i + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

RelatedListings.craft = { displayName: 'Related Listings', props: { count: 3, cardStyle: 'card' } };
```

- [ ] **Step 8.12: Create `components/editor-blocks/index.ts`**

```typescript
// Generic blocks
export { Section } from './generic/Section';
export { Text } from './generic/Text';
export { ImageBlock } from './generic/ImageBlock';
export { ButtonBlock } from './generic/ButtonBlock';
export { Divider } from './generic/Divider';
export { Spacer } from './generic/Spacer';

// Listing Grid page blocks
export { HeroBanner } from './listing-grid/HeroBanner';
export { FilterBar } from './listing-grid/FilterBar';
export { ListingGridBlock } from './listing-grid/ListingGridBlock';
export { Pagination } from './listing-grid/Pagination';
export { FooterBlock } from './listing-grid/FooterBlock';

// Listing Detail page blocks
export { ImageGallery } from './listing-detail/ImageGallery';
export { PriceTag } from './listing-detail/PriceTag';
export { SpecsTable } from './listing-detail/SpecsTable';
export { Description } from './listing-detail/Description';
export { CTASection } from './listing-detail/CTASection';
export { RelatedListings } from './listing-detail/RelatedListings';

// Resolver map for Craft.js Editor
export const BLOCK_RESOLVER = {
  Section,
  Text,
  ImageBlock,
  ButtonBlock,
  Divider,
  Spacer,
  HeroBanner,
  FilterBar,
  ListingGridBlock,
  Pagination,
  FooterBlock,
  ImageGallery,
  PriceTag,
  SpecsTable,
  Description,
  CTASection,
  RelatedListings,
} as const;

// Metadata for the block palette (left icon strip)
export const BLOCK_PALETTE = {
  listingGrid: [
    { name: 'HeroBanner', label: 'Hero Banner', icon: '🖼' },
    { name: 'FilterBar', label: 'Filter Bar', icon: '🔍' },
    { name: 'ListingGridBlock', label: 'Listing Grid', icon: '⊞' },
    { name: 'Pagination', label: 'Pagination', icon: '⟨⟩' },
    { name: 'FooterBlock', label: 'Footer', icon: '📄' },
  ],
  listingDetail: [
    { name: 'ImageGallery', label: 'Image Gallery', icon: '🖼' },
    { name: 'PriceTag', label: 'Price Tag', icon: '💰' },
    { name: 'SpecsTable', label: 'Specs Table', icon: '📊' },
    { name: 'Description', label: 'Description', icon: '📝' },
    { name: 'CTASection', label: 'CTA Section', icon: '📞' },
    { name: 'RelatedListings', label: 'Related', icon: '🔗' },
  ],
  generic: [
    { name: 'Section', label: 'Section', icon: '📦' },
    { name: 'Text', label: 'Text', icon: 'T' },
    { name: 'ImageBlock', label: 'Image', icon: '🖼' },
    { name: 'ButtonBlock', label: 'Button', icon: '🔘' },
    { name: 'Divider', label: 'Divider', icon: '—' },
    { name: 'Spacer', label: 'Spacer', icon: '↕' },
  ],
} as const;
```

- [ ] **Step 8.13: Commit**

```bash
git add components/editor-blocks/
git commit -m "feat: add domain-specific and generic editor blocks"
```

---

## Task 9: Editor Pages

**Files:**
- Create: `app/(app)/templates/page.tsx`
- Create: `app/(app)/templates/editor/[configId]/page.tsx`
- Create: `app/(app)/templates/editor/[configId]/EditorClient.tsx`

- [ ] **Step 9.1: Create `app/(app)/templates/page.tsx`**

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { raw } from "@/db/client";
import Link from "next/link";

interface Config {
  id: number;
  dealerId: number | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  isActive: number;
}

async function getTemplatesForSession(session: { role: string; dealerId: number | null }) {
  if (session.role === "admin") {
    return raw
      .prepare(
        `SELECT dtc.id, dtc.dealer_id as dealerId, dtc.name,
                dtc.created_at as createdAt, dtc.updated_at as updatedAt,
                CASE WHEN d.active_template_config_id = dtc.id THEN 1 ELSE 0 END as isActive
         FROM dealer_template_configs dtc
         LEFT JOIN dealers d ON d.id = dtc.dealer_id
         ORDER BY dtc.dealer_id IS NULL DESC, dtc.dealer_id ASC, dtc.created_at ASC`,
      )
      .all() as Config[];
  }
  if (!session.dealerId) return [];
  return raw
    .prepare(
      `SELECT dtc.id, dtc.dealer_id as dealerId, dtc.name,
              dtc.created_at as createdAt, dtc.updated_at as updatedAt,
              CASE WHEN d.active_template_config_id = dtc.id THEN 1 ELSE 0 END as isActive
       FROM dealer_template_configs dtc
       LEFT JOIN dealers d ON d.id = dtc.dealer_id
       WHERE dtc.dealer_id = ? OR dtc.dealer_id IS NULL
       ORDER BY dtc.dealer_id IS NULL DESC, dtc.created_at ASC`,
    )
    .all(session.dealerId) as Config[];
}

export default async function TemplatesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as { role: string; dealerId: number | null };
  const configs = await getTemplatesForSession(user);

  const bases = configs.filter((c) => c.dealerId === null);
  const mine = configs.filter((c) => c.dealerId !== null);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Template Configs</h1>
      </div>

      {mine.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">My Configs</h2>
          <div className="space-y-2">
            {mine.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                <div>
                  <span className="font-medium">{c.name}</span>
                  {c.isActive === 1 && <span className="ml-2 text-xs bg-green-900 text-green-300 border border-green-700 rounded px-2 py-0.5">Active</span>}
                  <div className="text-xs text-gray-500 mt-0.5">Updated {new Date(c.updatedAt).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  {c.isActive === 0 && (
                    <ActivateButton configId={c.id} />
                  )}
                  <Link href={`/templates/editor/${c.id}`} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md">Edit</Link>
                  <ForkButton configId={c.id} />
                  {c.isActive === 0 && <DeleteButton configId={c.id} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Base Templates (fork to use)</h2>
        <div className="grid grid-cols-3 gap-3">
          {bases.map((c) => (
            <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="font-medium mb-3">{c.name}</div>
              <ForkBaseButton configId={c.id} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// These are client components defined below — inline for simplicity
function ActivateButton({ configId }: { configId: number }) {
  return (
    <form action={`/api/dealer-templates/${configId}/activate`} method="POST">
      <button type="submit" className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-md">Activate</button>
    </form>
  );
}

function ForkButton({ configId }: { configId: number }) {
  return (
    <form action={`/api/dealer-templates/${configId}/fork`} method="POST">
      <button type="submit" className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-md">Fork</button>
    </form>
  );
}

function ForkBaseButton({ configId }: { configId: number }) {
  return (
    <form action={`/api/dealer-templates/${configId}/fork`} method="POST">
      <button type="submit" className="text-sm w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-md">Use This Template</button>
    </form>
  );
}

function DeleteButton({ configId }: { configId: number }) {
  return (
    <form action={`/api/dealer-templates/${configId}/delete`} method="POST">
      <button type="submit" className="text-sm bg-red-900/60 hover:bg-red-800 text-red-300 px-3 py-1.5 rounded-md">Delete</button>
    </form>
  );
}
```

**Note:** The fork/activate/delete buttons above use form POST which will redirect after action. For a better UX, these should be client components using fetch — but a simple form POST is sufficient for the initial implementation. Upgrade to client-side fetch in a follow-up if needed.

- [ ] **Step 9.2: Create `app/(app)/templates/editor/[configId]/EditorClient.tsx`**

This is the heavy client component that loads Craft.js. It must be `'use client'`.

```typescript
'use client';
import { useEffect, useState, useCallback } from 'react';
import { Editor, Frame, Element, useEditor } from '@craftjs/core';
import { BLOCK_RESOLVER, BLOCK_PALETTE } from '@/components/editor-blocks';
import type { DealerTemplateConfig } from '@/lib/queries';

// ── Toolbar ──────────────────────────────────────────────────────────────────

function EditorToolbar({
  name,
  configId,
  pageType,
  onPageTypeChange,
}: {
  name: string;
  configId: number;
  pageType: 'listingGrid' | 'listingDetail';
  onPageTypeChange: (t: 'listingGrid' | 'listingDetail') => void;
}) {
  const { actions, query, canUndo, canRedo } = useEditor((state, q) => ({
    canUndo: q.history.canUndo(),
    canRedo: q.history.canRedo(),
  }));
  const [saving, setSaving] = useState(false);
  const [configName, setConfigName] = useState(name);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const serialized = query.serialize();
      // We save only the current page type's state — merge with existing on server
      const res = await fetch(`/api/dealer-templates/${configId}/save-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageType, craftState: serialized, name: configName }),
      });
      if (!res.ok) throw new Error('Save failed');
    } finally {
      setSaving(false);
    }
  }, [query, configId, pageType, configName]);

  return (
    <div className="flex items-center gap-3 px-4 h-12 bg-gray-900 border-b border-gray-700 shrink-0">
      <input
        value={configName}
        onChange={(e) => setConfigName(e.target.value)}
        className="bg-transparent text-sm font-medium text-white border-b border-transparent hover:border-gray-600 focus:border-blue-500 outline-none px-1 py-0.5 w-48"
      />
      <div className="flex gap-1 ml-2">
        <button
          onClick={() => actions.history.undo()}
          disabled={!canUndo}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 rounded"
        >
          ↩ Undo
        </button>
        <button
          onClick={() => actions.history.redo()}
          disabled={!canRedo}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 rounded"
        >
          ↪ Redo
        </button>
      </div>
      <div className="flex gap-1 ml-2 bg-gray-800 rounded-md p-0.5">
        {(['listingGrid', 'listingDetail'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onPageTypeChange(t)}
            className={`text-xs px-3 py-1 rounded ${pageType === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {t === 'listingGrid' ? 'Grid Page' : 'Detail Page'}
          </button>
        ))}
      </div>
      <div className="ml-auto flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-md font-medium"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Block palette (left strip) ────────────────────────────────────────────────

function BlockPalette({ pageType }: { pageType: 'listingGrid' | 'listingDetail' }) {
  const { connectors } = useEditor();
  const pagePalette = BLOCK_PALETTE[pageType];
  const genericPalette = BLOCK_PALETTE.generic;

  return (
    <div className="w-14 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-2 gap-1 overflow-y-auto shrink-0">
      {[...pagePalette, ...genericPalette].map((item) => {
        const BlockComp = BLOCK_RESOLVER[item.name as keyof typeof BLOCK_RESOLVER];
        return (
          <button
            key={item.name}
            ref={(ref) => ref && connectors.create(ref, <BlockComp />)}
            className="flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-gray-800 cursor-grab w-12"
            title={item.label}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="text-[9px] text-gray-400 leading-tight text-center">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Properties panel (right) ─────────────────────────────────────────────────

function PropertiesPanel() {
  const { selected, actions } = useEditor((state) => {
    const selectedIds = state.events.selected;
    const id = selectedIds.size > 0 ? [...selectedIds][0] : null;
    return { selected: id ? { id, node: state.nodes[id] } : null };
  });

  if (!selected) {
    return (
      <div className="w-60 bg-gray-900 border-l border-gray-700 flex items-center justify-center text-gray-500 text-sm shrink-0">
        Select a block
      </div>
    );
  }

  const { id, node } = selected;
  const props = node.data.props as Record<string, unknown>;

  const setProp = (key: string, value: unknown) => {
    actions.setProp(id, (p: Record<string, unknown>) => { p[key] = value; });
  };

  return (
    <div className="w-60 bg-gray-900 border-l border-gray-700 overflow-y-auto shrink-0">
      <div className="px-3 py-2 border-b border-gray-700 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {node.data.displayName}
      </div>
      <div className="p-3 space-y-3">
        {Object.entries(props).map(([key, value]) => (
          <PropControl key={key} propKey={key} value={value} onChange={(v) => setProp(key, v)} />
        ))}
      </div>
    </div>
  );
}

function PropControl({ propKey, value, onChange }: { propKey: string; value: unknown; onChange: (v: unknown) => void }) {
  const label = propKey.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center justify-between">
        <span className="text-xs text-gray-300">{label}</span>
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      </label>
    );
  }
  if (typeof value === 'number') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">{label}</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white w-full"
        />
      </label>
    );
  }
  if (typeof value === 'string' && (value.startsWith('#') || propKey.toLowerCase().includes('color'))) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">{label}</span>
        <div className="flex gap-2 items-center">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-10 rounded cursor-pointer bg-transparent border-0" />
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white flex-1" />
        </div>
      </label>
    );
  }
  if (typeof value === 'string') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">{label}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white w-full"
        />
      </label>
    );
  }
  return null;
}

// ── Main editor client component ─────────────────────────────────────────────

export function EditorClient({ config }: { config: DealerTemplateConfig }) {
  const [pageType, setPageType] = useState<'listingGrid' | 'listingDetail'>('listingGrid');

  const parsedConfig = JSON.parse(config.configJson) as {
    listingGrid: object;
    listingDetail: object;
  };

  const currentState = JSON.stringify(parsedConfig[pageType]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <Editor resolver={BLOCK_RESOLVER}>
        <EditorToolbar
          name={config.name}
          configId={config.id}
          pageType={pageType}
          onPageTypeChange={setPageType}
        />
        <div className="flex flex-1 overflow-hidden">
          <BlockPalette pageType={pageType} />
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            <div className="bg-white min-h-full shadow-sm">
              <Frame key={pageType} data={currentState} />
            </div>
          </div>
          <PropertiesPanel />
        </div>
      </Editor>
    </div>
  );
}
```

- [ ] **Step 9.3: Add save-page API route**

Create `app/api/dealer-templates/[id]/save-page/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { getDealerTemplateConfig, updateDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const configId = parseInt(id, 10);
  const config = getDealerTemplateConfig(configId);
  if (!config) return Response.json({ error: "Not found" }, { status: 404 });

  if (config.dealerId === null) {
    return Response.json({ error: "Base templates are read-only" }, { status: 403 });
  }

  const isAdmin = (session.user as { role: string }).role === "admin";
  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && sessionDealerId !== config.dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as {
    pageType: 'listingGrid' | 'listingDetail';
    craftState: string;
    name?: string;
  };

  if (!body.pageType || !body.craftState) {
    return Response.json({ error: "pageType and craftState required" }, { status: 400 });
  }

  const existing = JSON.parse(config.configJson) as Record<string, unknown>;
  existing[body.pageType] = JSON.parse(body.craftState);
  const newConfigJson = JSON.stringify(existing);

  updateDealerTemplateConfig(configId, {
    configJson: newConfigJson,
    ...(body.name ? { name: body.name } : {}),
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 9.4: Create `app/(app)/templates/editor/[configId]/page.tsx`**

```typescript
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDealerTemplateConfig } from "@/lib/queries";
import { EditorClient } from "./EditorClient";

interface Props { params: Promise<{ configId: string }> }

export default async function EditorPage({ params }: Props) {
  const { configId } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const id = parseInt(configId, 10);
  const config = getDealerTemplateConfig(id);
  if (!config) notFound();

  const user = session.user as { role: string; dealerId?: number | null };
  const isAdmin = user.role === "admin";
  if (!isAdmin && user.dealerId !== config.dealerId) redirect("/templates");

  return <EditorClient config={config} />;
}

export async function generateMetadata({ params }: Props) {
  const { configId } = await params;
  const config = getDealerTemplateConfig(parseInt(configId, 10));
  return { title: config ? `Edit: ${config.name}` : "Template Editor" };
}
```

- [ ] **Step 9.5: Commit**

```bash
git add app/\(app\)/templates/ app/api/dealer-templates/
git commit -m "feat: add template editor pages and save-page API"
```

---

## Task 10: Add Templates to Sidebar Nav

**Files:**
- Modify: `components/AppSidebar.tsx`

- [ ] **Step 10.1: Add Templates link to navItems**

In `components/AppSidebar.tsx`, add to the `navItems` array after the `{ href: '/config', ... }` entry:

```typescript
  { href: '/templates', label: 'Templates', icon: TemplateIcon },
```

Add the icon SVG alongside the other icon definitions in the same file:

```typescript
function TemplateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M3 9h18M3 15h18" />
    </svg>
  );
}
```

- [ ] **Step 10.2: Start dev server and verify nav link appears**

```bash
npm run dev
```

Open `http://localhost:3000` in the browser. The sidebar should show "Templates" as a nav item.

- [ ] **Step 10.3: Commit**

```bash
git add components/AppSidebar.tsx
git commit -m "feat: add Templates link to sidebar nav"
```

---

## Task 11: Public Renderer

**Files:**
- Create: `lib/template-renderer.ts`
- Modify: `lib/query-modules/public.ts`
- Modify: `app/(public)/d/[slug]/page.tsx`
- Modify: `app/(public)/d/[slug]/[mobileId]/page.tsx`

- [ ] **Step 11.1: Add `activeTemplateConfigId` to `PublicDealer` type and query**

In `lib/query-modules/public.ts`, update `PublicDealer`:

```typescript
export interface PublicDealer {
  id: number;
  slug: string;
  name: string;
  template: string;
  publicDomain: string | null;
  publicEnabled: number;
  activeTemplateConfigId: number | null;
}
```

Update the `getPublicDealer` SELECT to include the new column:

```typescript
export function getPublicDealer(slug: string): PublicDealer | null {
  const row = raw
    .prepare(
      `SELECT id, slug, name,
        COALESCE(template, 'bold') as template,
        public_domain as publicDomain,
        COALESCE(public_enabled, 0) as publicEnabled,
        active_template_config_id as activeTemplateConfigId
       FROM dealers
       WHERE slug = ? AND active = 1
       LIMIT 1`,
    )
    .get(slug) as PublicDealer | undefined;
  return row ?? null;
}
```

Also update `getDealerByDomain` to add the same column.

- [ ] **Step 11.2: Create `lib/template-renderer.ts`**

```typescript
import React from "react";
import type { PublicDealer, PublicListing, PublicListingDetail } from "./query-modules/public";

// ── Types ─────────────────────────────────────────────────────────────────

export interface RenderData {
  dealer: PublicDealer;
  listings?: PublicListing[];
  listing?: PublicListingDetail;
  total?: number;
  page?: number;
  limit?: number;
  makes?: string[];
}

interface CraftNode {
  type: { resolvedName: string };
  props: Record<string, unknown>;
  nodes: string[];
  linkedNodes: Record<string, string>;
  isCanvas?: boolean;
  hidden?: boolean;
}

type CraftState = Record<string, CraftNode>;

// ── Block renderer registry ───────────────────────────────────────────────
// These are server-side renderers — they receive props + live data and
// return React elements. No Craft.js dependency.

type BlockRenderer = (props: Record<string, unknown>, data: RenderData, children: React.ReactNode) => React.ReactElement;

const BLOCK_RENDERER_REGISTRY: Record<string, BlockRenderer> = {
  Section: ({ backgroundColor, padding, maxWidth }, _data, children) =>
    React.createElement('div', {
      style: { backgroundColor: backgroundColor ?? '#fff', padding: padding ?? 24, maxWidth: maxWidth ?? 1200, margin: '0 auto', width: '100%' },
    }, children),

  Text: ({ content, fontSize, color, fontWeight, textAlign, as: tag }) =>
    React.createElement(String(tag ?? 'p'), {
      style: { fontSize: fontSize ?? 16, color: color ?? '#1a1a1a', fontWeight: fontWeight ?? 'normal', textAlign: textAlign ?? 'left', margin: 0 },
    }, String(content ?? '')),

  ImageBlock: ({ src, alt, width, alignment, linkHref }) => {
    const img = React.createElement('img', { src: String(src ?? ''), alt: String(alt ?? ''), style: { width: String(width ?? '100%'), display: 'block' } });
    return React.createElement('div', { style: { textAlign: String(alignment ?? 'left') } },
      linkHref ? React.createElement('a', { href: String(linkHref) }, img) : img
    );
  },

  ButtonBlock: ({ label, href, backgroundColor, color, size }) => {
    const SIZES: Record<string, string> = { sm: '8px 16px', md: '12px 24px', lg: '16px 32px' };
    return React.createElement('a', {
      href: String(href ?? '#'),
      style: { display: 'inline-block', backgroundColor: backgroundColor ?? '#2563eb', color: color ?? '#fff', padding: SIZES[String(size ?? 'md')] ?? '12px 24px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 },
    }, String(label ?? 'Click here'));
  },

  Divider: ({ color, thickness, marginY }) =>
    React.createElement('hr', {
      style: { borderColor: color ?? '#e5e7eb', borderWidth: thickness ?? 1, borderStyle: 'solid', margin: `${marginY ?? 16}px 0` },
    }),

  Spacer: ({ height }) => React.createElement('div', { style: { height: height ?? 32 } }),

  HeroBanner: ({ backgroundColor, height, showLogo, tagline, fontColor }, data) =>
    React.createElement('div', {
      style: { backgroundColor: backgroundColor ?? '#1e293b', height: height ?? 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: fontColor ?? '#fff' },
    },
      showLogo !== false && React.createElement('div', { style: { fontSize: 24, fontWeight: 700 } }, data.dealer.name),
      tagline && React.createElement('div', { style: { fontSize: 14, opacity: 0.8 } }, String(tagline)),
    ),

  FilterBar: ({ backgroundColor, layout }, _data) =>
    React.createElement('form', {
      style: { backgroundColor: backgroundColor ?? '#f8fafc', padding: '12px 16px', display: 'flex', flexDirection: layout === 'vertical' ? 'column' : 'row', gap: 8, flexWrap: 'wrap' },
    },
      React.createElement('select', { name: 'make', style: { padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 } },
        React.createElement('option', { value: '' }, 'Any Make')
      ),
      React.createElement('input', { type: 'submit', value: 'Filter', style: { padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' } }),
    ),

  ListingGridBlock: ({ columns, cardStyle, gap, showPrice, showMileage, showYear, showFuel }, data) => {
    const listings = data.listings ?? [];
    return React.createElement('div', {
      style: { display: 'grid', gridTemplateColumns: `repeat(${columns ?? 3}, 1fr)`, gap: gap ?? 16, padding: 16 },
    },
      listings.map((l) =>
        React.createElement('a', {
          key: l.mobileId,
          href: `${l.mobileId}`,
          style: { borderRadius: cardStyle === 'card' ? 8 : 0, border: cardStyle === 'card' ? '1px solid #e2e8f0' : 'none', overflow: 'hidden', background: '#fff', display: 'block', textDecoration: 'none', color: 'inherit' },
        },
          React.createElement('div', { style: { height: 160, background: '#e2e8f0', overflow: 'hidden', position: 'relative' } }),
          React.createElement('div', { style: { padding: '8px 12px' } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: 14, marginBottom: 4 } }, `${l.make ?? ''} ${l.model ?? ''} ${l.regYear ?? ''}`),
            React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#64748b' } },
              showPrice !== false && l.currentPrice && React.createElement('span', null, `€${l.currentPrice.toLocaleString()}`),
              showYear !== false && l.regYear && React.createElement('span', null, l.regYear),
              showMileage !== false && l.mileage && React.createElement('span', null, `${l.mileage.toLocaleString()} km`),
              showFuel !== false && l.fuel && React.createElement('span', null, l.fuel),
            ),
          ),
        )
      )
    );
  },

  Pagination: ({ style: pStyle, color }, data) => {
    const totalPages = Math.ceil((data.total ?? 0) / (data.limit ?? 24));
    const current = data.page ?? 1;
    if (totalPages <= 1) return React.createElement(React.Fragment, null);
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 8, padding: 16 } },
      pStyle === 'prev-next'
        ? [
            current > 1 && React.createElement('a', { key: 'prev', href: `?page=${current - 1}`, style: { padding: '6px 16px', border: `1px solid ${color ?? '#2563eb'}`, borderRadius: 6, color: color ?? '#2563eb', textDecoration: 'none', fontSize: 13 } }, '← Previous'),
            current < totalPages && React.createElement('a', { key: 'next', href: `?page=${current + 1}`, style: { padding: '6px 16px', background: color ?? '#2563eb', borderRadius: 6, color: '#fff', textDecoration: 'none', fontSize: 13 } }, 'Next →'),
          ]
        : Array.from({ length: totalPages }, (_, i) => i + 1).map((n) =>
            React.createElement('a', { key: n, href: `?page=${n}`, style: { width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: n === current ? (color ?? '#2563eb') : '#f1f5f9', color: n === current ? '#fff' : '#475569', fontSize: 13, fontWeight: 600, textDecoration: 'none' } }, n)
          )
    );
  },

  FooterBlock: ({ backgroundColor, fontColor, showAddress, showPhone, showEmail }, data) =>
    React.createElement('footer', {
      style: { backgroundColor: backgroundColor ?? '#1e293b', color: fontColor ?? '#cbd5e1', padding: '24px 32px', fontSize: 13 },
    },
      React.createElement('div', { style: { fontWeight: 600, fontSize: 16, marginBottom: 8 } }, data.dealer.name),
      showAddress !== false && React.createElement('div', null, '📍 Address on file'),
    ),

  ImageGallery: ({ layout, maxHeight }, data) => {
    const listing = data.listing;
    if (!listing) return React.createElement('div', null);
    return React.createElement('div', { style: { background: '#e2e8f0', height: maxHeight ?? 400, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#94a3b8' } },
      `${listing.imageCount ?? 0} photos`
    );
  },

  PriceTag: ({ showVat, fontSize, color }, data) => {
    const price = data.listing?.currentPrice;
    if (!price) return React.createElement('div', null);
    return React.createElement('div', { style: { padding: '12px 0' } },
      React.createElement('div', { style: { fontSize: fontSize ?? 32, fontWeight: 700, color: color ?? '#1e293b' } }, `€${price.toLocaleString()}`),
      showVat !== false && React.createElement('div', { style: { fontSize: 12, color: '#64748b', marginTop: 2 } }, 'incl. VAT'),
    );
  },

  SpecsTable: ({ showMileage, showFuel, showPower, showTransmission, showYear, layout }, data) => {
    const l = data.listing;
    if (!l) return React.createElement('div', null);
    const specs = [
      showMileage !== false && l.mileage ? { label: 'Mileage', value: `${l.mileage.toLocaleString()} km` } : null,
      showFuel !== false && l.fuel ? { label: 'Fuel', value: l.fuel } : null,
      showPower !== false && l.power ? { label: 'Power', value: `${l.power} kW` } : null,
      showTransmission !== false && l.transmission ? { label: 'Transmission', value: l.transmission } : null,
      showYear !== false && l.regYear ? { label: 'Year', value: l.regYear } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    return React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 14 } },
      React.createElement('tbody', null,
        specs.map((s) =>
          React.createElement('tr', { key: s.label, style: { borderBottom: '1px solid #e2e8f0' } },
            React.createElement('td', { style: { padding: '8px 0', color: '#64748b', width: '40%' } }, s.label),
            React.createElement('td', { style: { padding: '8px 0', fontWeight: 600 } }, s.value),
          )
        )
      )
    );
  },

  Description: ({ fontSize, color, maxHeight, truncate }, data) => {
    const text = data.listing?.description ?? '';
    return React.createElement('div', {
      style: { fontSize: fontSize ?? 15, color: color ?? '#334155', lineHeight: 1.6, maxHeight: truncate !== false ? (maxHeight ?? 200) : undefined, overflow: truncate !== false ? 'hidden' : undefined, padding: '8px 0' },
    }, text);
  },

  CTASection: ({ showPhone, showEmail, showWhatsapp, buttonColor, layout }, data) =>
    React.createElement('div', {
      style: { display: 'flex', flexDirection: layout === 'column' ? 'column' : 'row', gap: 12, padding: '16px 0', flexWrap: 'wrap' },
    },
      showPhone !== false && React.createElement('a', { href: 'tel:', style: { padding: '12px 24px', background: buttonColor ?? '#2563eb', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' } }, '📞 Call'),
      showEmail !== false && React.createElement('a', { href: 'mailto:', style: { padding: '12px 24px', border: `2px solid ${buttonColor ?? '#2563eb'}`, color: buttonColor ?? '#2563eb', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' } }, '✉️ Email'),
      showWhatsapp !== false && React.createElement('a', { href: 'https://wa.me/', style: { padding: '12px 24px', background: '#25d366', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' } }, 'WhatsApp'),
    ),

  RelatedListings: ({ count, cardStyle }) =>
    React.createElement('div', { style: { padding: '16px 0' } },
      React.createElement('h3', { style: { fontSize: 18, fontWeight: 600, marginBottom: 12 } }, 'Similar Cars'),
    ),
};

// ── Recursive renderer ────────────────────────────────────────────────────

export function renderCraftNode(
  nodeId: string,
  state: CraftState,
  data: RenderData,
): React.ReactElement | null {
  const node = state[nodeId];
  if (!node || node.hidden) return null;

  const children = node.nodes
    .map((childId) => renderCraftNode(childId, state, data))
    .filter(Boolean) as React.ReactElement[];

  const typeName = node.type.resolvedName;
  const renderer = BLOCK_RENDERER_REGISTRY[typeName];

  if (!renderer) {
    console.warn(`No renderer for block type: ${typeName}`);
    return children.length > 0 ? React.createElement(React.Fragment, null, ...children) : null;
  }

  return renderer(node.props, data, children.length > 0 ? React.createElement(React.Fragment, null, ...children) : null);
}

export function renderCraftPage(
  configJson: string,
  pageType: 'listingGrid' | 'listingDetail',
  data: RenderData,
): React.ReactElement {
  const parsed = JSON.parse(configJson) as Record<string, CraftState>;
  const pageState = parsed[pageType];
  if (!pageState) return React.createElement('div', null, 'No template configured');
  return renderCraftNode('ROOT', pageState, data) ?? React.createElement('div', null);
}
```

- [ ] **Step 11.3: Update `app/(public)/d/[slug]/page.tsx`**

Replace the `Template` logic in the return with:

```typescript
import { renderCraftPage } from "@/lib/template-renderer";
import type { RenderData } from "@/lib/template-renderer";

// Inside the page component, replace the Template block:

  if (dealer.activeTemplateConfigId) {
    const { getDealerTemplateConfig } = await import("@/lib/queries");
    const config = getDealerTemplateConfig(dealer.activeTemplateConfigId);
    if (config) {
      const renderData: RenderData = {
        dealer,
        listings: result.listings,
        total: result.total,
        page: result.page,
        limit: result.limit,
        makes: result.makes,
      };
      return renderCraftPage(config.configJson, 'listingGrid', renderData);
    }
  }

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
```

- [ ] **Step 11.4: Update `app/(public)/d/[slug]/[mobileId]/page.tsx`**

Apply the same pattern for the detail page:

```typescript
import { renderCraftPage } from "@/lib/template-renderer";
import type { RenderData } from "@/lib/template-renderer";

// Inside the page component, replace the Template block:

  if (dealer.activeTemplateConfigId) {
    const { getDealerTemplateConfig } = await import("@/lib/queries");
    const config = getDealerTemplateConfig(dealer.activeTemplateConfigId);
    if (config) {
      const renderData: RenderData = { dealer, listing };
      return renderCraftPage(config.configJson, 'listingDetail', renderData);
    }
  }

  const Template =
    TEMPLATE_REGISTRY[dealer.template as keyof typeof TEMPLATE_REGISTRY] ??
    TEMPLATE_REGISTRY.bold;

  return <Template.ListingDetail dealer={dealer} listing={listing} />;
```

- [ ] **Step 11.5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 11.6: Commit**

```bash
git add lib/template-renderer.ts lib/query-modules/public.ts app/\(public\)/
git commit -m "feat: add Craft.js public renderer and wire to public pages"
```

---

## Task 12: End-to-End Smoke Test

- [ ] **Step 12.1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 12.2: Verify seed templates exist**

```bash
sqlite3 /Users/v/dev/scraped/listings.db "SELECT id, name, dealer_id FROM dealer_template_configs ORDER BY id;"
```

Expected: 6 rows with `dealer_id = NULL` (Bold, Executive, Atlas, Night, Sunset, Pro).

- [ ] **Step 12.3: Test templates list page**

Open `http://localhost:3000/templates`. Expected: page loads, base templates section shows 6 cards.

- [ ] **Step 12.4: Fork a base template**

Use the "Use This Template" button on "Bold". Confirm a new row appears in the "My Configs" section (or in the DB: `SELECT * FROM dealer_template_configs WHERE dealer_id IS NOT NULL;`).

Note: The fork will 403 because the dev auto-login user is admin with no `dealer_id`. To test fork as a dealer, either:
- Assign a `dealer_id` to the admin user temporarily in the DB
- Or verify the API returns the correct error via curl:
  ```bash
  curl -X POST http://localhost:3000/api/dealer-templates/1/fork -H "Content-Type: application/json" -d '{"name":"My Bold","dealerId":1}'
  ```

- [ ] **Step 12.5: Open the editor**

Navigate to `/templates/editor/1` (the Bold base config). The Craft.js editor should render with the left block strip, canvas, and right properties panel.

Click a block in the palette strip — it should appear on the canvas (or allow dragging).

- [ ] **Step 12.6: Test public renderer fallback**

Existing public dealer pages (`/d/[slug]`) should still work with the `TEMPLATE_REGISTRY` fallback (since no active config is set). Confirm a public dealer page loads without errors.

- [ ] **Step 12.7: Activate a config and test renderer**

Via SQL:
```bash
sqlite3 /Users/v/dev/scraped/listings.db "UPDATE dealers SET active_template_config_id = 1 WHERE id = 1;"
```

Then reload the dealer's public page (`/d/[slug]`). It should render using `renderCraftPage` (may look minimal — the base config has an empty canvas). Confirm no server errors.

Reset:
```bash
sqlite3 /Users/v/dev/scraped/listings.db "UPDATE dealers SET active_template_config_id = NULL WHERE id = 1;"
```

- [ ] **Step 12.8: Final commit**

```bash
git add -A
git commit -m "feat: template editor smoke test pass"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| users.role / users.dealer_id columns | Task 1 |
| dealer_template_configs table | Task 1 |
| dealers.active_template_config_id | Task 1 |
| dealer_id + role in JWT/session | Task 2 |
| 6 base template seed rows | Task 4 |
| GET/POST /api/dealer-templates | Task 5 |
| PATCH /api/dealer-templates/[id] | Task 5 |
| fork / activate / delete endpoints | Task 5 |
| Craft.js installed | Task 6 |
| All 17 block components | Tasks 7–8 |
| Block resolver + palette | Task 8 |
| Templates list page | Task 9 |
| Craft.js editor (canvas + panels) | Task 9 |
| save-page per-page-type save | Task 9 |
| Public renderer (renderCraftNode) | Task 11 |
| /d/[slug] uses active config | Task 11 |
| /d/[slug]/[mobileId] uses active config | Task 11 |
| Sidebar nav link | Task 10 |
| Fallback to TEMPLATE_REGISTRY | Task 11 |

### Notes

- The templates list page uses plain HTML form POSTs for activate/fork/delete actions. These will cause full page reloads. Acceptable for the initial implementation; upgrade to client-side fetch calls in a follow-up if smoother UX is needed.
- The editor saves only one page type at a time (via `save-page`). The other page type's state is preserved in `config_json` by merging on the server.
- The `EditorClient` re-mounts the `<Frame>` when `pageType` changes (via `key={pageType}`). This discards unsaved changes to the previous page type. Consider warning the user before switching if there are pending changes.
- Base templates have `dealer_id = NULL` and are read-only. Fork API correctly handles both forking a base (creates from base's config_json) and forking a dealer config (clones the dealer's config).
- The public renderer uses `React.createElement` directly (no JSX) to stay compatible as a server utility without requiring JSX transform in lib/.
