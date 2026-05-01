# Template Editor Design

**Date:** 2026-05-01
**Status:** Approved

## Overview

An inline drag-and-drop template editor (Elementor-style) that lets each dealer customize their public listing pages and save those customizations as private template variants. Built on Craft.js for the editor mechanics; public pages render from the stored JSON without loading Craft.js.

## Goals

- Dealers can visually edit the layout, style, and content of their public listing grid and listing detail pages.
- Each dealer's customization is stored as a named template config, private to that dealer.
- Dealers can fork any of their existing configs (or a base template) to create a new variant.
- One config per dealer can be set as "active" — that is what the public page renders.
- Admins can manage all dealer template configs.
- If a dealer has no active config, the public page falls back to the existing base template.

## Library Choice

**Craft.js** (`@craftjs/core` v0.2.12, React 19 compatible, MIT).

Craft.js provides drag-and-drop, block selection, undo/redo, property panel wiring, and JSON serialization. The project owns the block components and block registry. Craft.js is only loaded in the editor — the public pages use a custom lightweight renderer.

## Data Model

### Extend `users` table

Add two columns via migration:

| column | type | notes |
|---|---|---|
| `role` | TEXT | `'admin'` or `'dealer'`, default `'admin'` |
| `dealer_id` | INTEGER | nullable FK to `dealers.id` |

### New `dealer_template_configs` table

```sql
CREATE TABLE dealer_template_configs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id        INTEGER REFERENCES dealers(id) ON DELETE CASCADE,
  base_template_id INTEGER REFERENCES dealer_template_configs(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  config_json      TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
```

- `dealer_id` — nullable. Null only for the six seed rows (built-in base templates), which are system-owned and read-only. All dealer-created configs must have a `dealer_id`.
- `base_template_id` — points to the config this row was forked from. Null for seed rows.
- `config_json` — Craft.js serialized state stored as a JSON object with two keys: `{ listingGrid: <CraftState>, listingDetail: <CraftState> }`. Both page types are saved together in a single column.

### Extend `dealers` table

Add one column:

| column | type | notes |
|---|---|---|
| `active_template_config_id` | INTEGER | nullable FK to `dealer_template_configs.id` |

The existing `template` string column remains as the base-template fallback when `active_template_config_id` is null.

### Seed data

The six base templates (bold, executive, atlas, night, sunset, pro) are seeded as rows in `dealer_template_configs` with `dealer_id = null` and `base_template_id = null`. They serve as the roots of the fork tree and are read-only.

## Auth

- `role` and `dealer_id` are included in the JWT and session.
- Dealer users can only access the editor for their own dealer: `session.dealer_id === config.dealer_id`.
- Admin users (`role === 'admin'`) can access all configs.
- Middleware on the editor route enforces this check and returns 401/403 otherwise.
- Dev auto-login (`__dev_auto__`) is unaffected — it logs in as admin.

## Editor UI

### Layout (Option A — Classic Elementor-style)

```
┌─────────────────────────────────────────────────────────────────┐
│  Template name  │  ↩ Undo  ↪ Redo  │  👁 Preview  │  [Save]    │  ← top bar
├──────┬──────────────────────────────────────────┬───────────────┤
│      │                                          │               │
│ icon │          Craft.js canvas                 │  Properties   │
│ strip│      (live drag-and-drop preview)        │  panel        │
│      │                                          │  (selected    │
│      │                                          │   block)      │
│      │                                          │               │
└──────┴──────────────────────────────────────────┴───────────────┘
```

- **Left icon strip** (~56px): one icon + label per block type. Drag onto canvas to add.
- **Center canvas**: Craft.js `<Frame>`. Clicking a block selects it (highlights blue outline + label).
- **Right panel** (~240px): property controls for the selected block — color pickers, sliders, toggles, selects. Empty state when nothing selected.
- **Top bar**: template name (editable inline), undo/redo buttons, preview link (opens public page in new tab), save button.

### Page type switcher

The editor handles two page types: **ListingGrid** and **ListingDetail**. A tab or toggle in the top bar switches between them. Each page type has its own Craft.js state; both are stored together in `config_json`.

## Block System

### Listing Grid page blocks

| Block | Description | Key props |
|---|---|---|
| `HeroBanner` | Dealer name, logo, cover photo, tagline | bg color/image, height, show logo, tagline text, font |
| `FilterBar` | Make/model/price/year filters | which filters are visible, layout (horizontal/vertical) |
| `ListingGrid` | Car cards grid | columns (2–4), card style, spacing, which fields to show on each card |
| `Pagination` | Page navigation | style: numbered / prev-next / load more |
| `Footer` | Dealer contact info, address, social links | show/hide fields, bg color, layout |

### Listing Detail page blocks

| Block | Description | Key props |
|---|---|---|
| `ImageGallery` | Photo carousel/grid | layout: slider / grid / filmstrip, max height |
| `PriceTag` | Price display | VAT toggle, font size, color |
| `SpecsTable` | Mileage, fuel, power, transmission, year | which specs to show, layout: table / cards |
| `Description` | Listing description text | font, size, max-height, truncate toggle |
| `CTASection` | Call/email/WhatsApp buttons | which channels to show, button color, label, layout |
| `RelatedListings` | Similar cars strip | count, card style |

### Generic blocks (both pages)

| Block | Description | Key props |
|---|---|---|
| `Section` | Layout container, other blocks drop inside | bg color/image, padding, max-width, column count |
| `Text` | Heading or paragraph | content, font, size, color, alignment |
| `Image` | Static image or dealer logo | src, width, alignment, link-on-click |
| `Button` | Standalone CTA button | label, color, href, size |
| `Divider` | Horizontal rule | color, thickness, margin |
| `Spacer` | Empty vertical space | height |

### Data injection

Data blocks (`ListingGrid`, `SpecsTable`, etc.) receive live server data at render time. Dealers configure *how* the data displays, not the data itself. The block components accept a `data` prop injected by the renderer with the real listings/listing/dealer values.

## Public Rendering

### Renderer

A lightweight recursive function `renderCraftNode(node, data)` in `lib/template-renderer.ts`:

1. Receives the root node from the parsed `config_json`.
2. Looks up the node type in a `BLOCK_RENDERER_REGISTRY` (maps type names to React components).
3. Merges stored `props` with live `data`.
4. Recursively renders child nodes.

No Craft.js dependency on the public page. The renderer outputs standard React elements; the page is a server component.

### Page resolution

```
/d/[slug]            → load dealer → check active_template_config_id
                        → if set: load config_json → renderCraftNode(root, { dealer, listings, filters })
                        → if null: use existing TEMPLATE_REGISTRY[dealer.template].ListingGrid
/d/[slug]/[mobileId] → same pattern with ListingDetail
```

## Routes

### App routes

| Route | Access | Purpose |
|---|---|---|
| `app/(app)/templates/page.tsx` | dealer (own) / admin (all) | List all configs for the current dealer; create new / fork / activate / delete |
| `app/(app)/templates/editor/[configId]/page.tsx` | dealer (own) / admin | Craft.js editor for one config |

### API routes

| Method + Path | Purpose |
|---|---|
| `GET /api/dealer-templates` | List configs for current dealer (admin sees all with `?dealerId=`) |
| `POST /api/dealer-templates` | Create new config; body: `{ dealerId, baseTemplateId, name }` — copies `config_json` from base |
| `PATCH /api/dealer-templates/[id]` | Save `config_json` and/or `name` |
| `POST /api/dealer-templates/[id]/fork` | Clone config as new row for same dealer; body: `{ name }` |
| `POST /api/dealer-templates/[id]/activate` | Set `dealers.active_template_config_id = id` |
| `DELETE /api/dealer-templates/[id]` | Delete config; blocks if it is currently active |

## Out of Scope

- Dealer login UI and registration flow (auth accounts for dealers will be created by the admin manually for now).
- Mobile-responsive editor canvas (editor is desktop-only; public pages are responsive).
- Template marketplace or sharing between dealers.
- Version history / snapshots beyond the single `config_json` per row.
- Real-time collaborative editing.
