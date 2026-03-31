# scrapeui — Best Practices & Conventions

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** SQLite + Drizzle ORM
- **Auth:** NextAuth v5 (beta) with credentials provider
- **UI:** React 19 + shadcn/ui + Tailwind CSS v4
- **Rich Text:** TipTap editor (for articles/descriptions)
- **Scraping:** Crawlee (for web automation)
- **Icons:** Lucide React
- **Forms:** HTML inputs with custom handlers (no form libraries)

## Project Structure

```
app/                 # Next.js App Router
  api/              # API routes (all read-only queries or mutations)
    dashboard/      # Dashboard stats endpoints
    listings/       # Listing queries and operations
    listings/[mobileId]/  # Single listing detail
    auth/           # NextAuth routes
    ...             # Other feature endpoints
  (app)/            # Protected routes (require auth)
    page.tsx        # Dashboard homepage
    listings/       # Listings browser
    editown/        # Own-listing draft editing + Mobile.bg sync
    mobilebg/       # Mobile.bg sync & workflow UI
    mapping/        # Brand & model mapping
    tasks/          # Task management
    kb/             # Knowledge base browser
  login/            # Auth page (public)
components/         # Reusable React components
  Dashboard.tsx     # Dashboard homepage (stats + quick links)
  AppSidebar.tsx    # Navigation sidebar
  TopBar.tsx        # Top navigation bar
  ui/               # shadcn/ui components (auto-generated)
  shared/           # Custom shared components (badges, selectors)
  editor/           # TipTap editor components
db/                 # Database schema & client (better-sqlite3)
lib/                # Utilities & queries
  auth.*            # NextAuth config & types
  queries.ts        # Database query functions (business logic)
  utils.ts          # Helper functions
scraper/            # Web scraping logic
scripts/            # Migration & seed scripts
```

## Authentication & Sessions

### NextAuth Setup

- Uses credentials provider with bcryptjs for password hashing
- Dev mode auto-login: password `__dev_auto__` in development skips bcrypt check
- Session stores: `user.id`, `user.username`, `user.name`, `user.role`
- JWT includes: `id`, `role`, `username`

### Protected Routes

- Routes under `app/(app)/` require authentication
- Check session with `useSession()` hook in client components
- Never commit auth tokens or secrets; use `.env.local`

## Database & ORM

### Drizzle ORM Patterns

- Schema defined in `db/schema.ts` (one table per export)
- Always use `better-sqlite3` raw client for complex queries: `raw.prepare(sql)`
- Integer booleans: `0` = false, `1` = true (SQLite has no native boolean)
- Date fields: store as ISO strings (`text('date')`)

### Common Tables

- **dealers:** external sources (mobile.bg, cars.bg) with credentials
- **listings:** scraped snapshot of listings; treat as read-only source data
- **listing_snapshots:** price/status history for tracking changes
- **mobilebg_backup_runs:** Mobile.bg dealer backup jobs
- **mobilebg_backups:** canonical editable draft for own Mobile.bg listings
- **mobilebg_backup_images:** local image metadata for backups
- **mobilebg_edit_form_snapshots:** captured Mobile.bg edit form structure for repost/update
- **mobilebg_repost_jobs:** Mobile.bg repost execution history
- **tasks:** todo items with subtasks, dependencies, comments
- **users, labels, expenses, articles, notifications**

### Query Patterns

- All business logic queries live in `lib/queries.ts`
- Export functions like `getListings()`, `createTask()`, etc.
- Use synchronous `better-sqlite3` (not async)
- Always validate input parameters (page, limit, sort fields)
- For own listings, join `mobilebg_backups` to `listings` so draft fields come from backups and snapshot metadata comes from listings

## Components & UI

### Component Structure

- Client components: `'use client'` at top
- Server components: no directive (default)
- Co-locate state: keep `useState` with rendering logic
- Use `cn()` (from `clsx`) for conditional classes

### Styling

- Tailwind CSS v4 (no JIT config needed)
- Color scheme: dark mode by default (gray-900 bg, gray-700 borders)
- Components use shadcn/ui (avatar, badge, button, dialog, etc.)
- Custom icons from Lucide React (`<Icon className="h-4 w-4" />`)

### Forms & Inputs

- Use HTML `<input>`, `<select>`, `<textarea>` with custom handlers
- No form libraries (no React Hook Form, Formik, etc.)
- Validate on submit, show errors inline via `toast` (Sonner)
- Button loading state: use `disabled` attribute

### Common Components

- **Dashboard:** homepage with project stats (listing counts, last scraping time) and quick links
- **AppSidebar:** main navigation with nav items (routes & icons)
- **TopBar:** header with user menu
- **SessionProvider:** wraps app for NextAuth context
- **Editor components:** TipTapEditor, TiptapViewer, TiptapToolbar for rich text

## API Routes

### Dashboard Endpoints
- **GET `/api/dashboard/stats`:** returns project overview stats
  - `totalListings`: all listings in the system
  - `activeListings`: active (is_active = 1) listings
  - `lastScrapingAt`: ISO timestamp of last completed backup run
  - `totalDealers`: count of active dealers

### Route Pattern

### Route Pattern

- GET routes: queries only, return `Response.json(data)`
- POST/PUT routes: mutations, validate session first
- Always validate query params (use `parseInt` with fallbacks)
- Limit pagination: max 100 per page

### Error Handling

- Return HTTP status codes (200, 400, 401, 404, 500)
- API errors logged to console; user sees toast notifications
- Don't expose internal error details to client

## Naming Conventions

### Files & Directories

- Components: `PascalCase.tsx` (e.g., `AppSidebar.tsx`)
- API routes: `route.ts` (Next.js convention)
- Server actions: use file-based routes, not inline
- Utilities: `camelCase.ts` (e.g., `queries.ts`, `utils.ts`)

### Database Fields

- Snake case in schema: `mobile_id`, `mobile_make_id`, `created_at`
- References to relations: `dealerId`, `listingId` (PascalCase in JS)

### Variables & Functions

- Constants: `UPPER_SNAKE_CASE` or `camelCase`
- Functions: `camelCase` (e.g., `getListings`, `createTask`)
- Booleans: prefix with `is` or `has` (e.g., `isActive`, `hasComments`)

## Common Patterns & Anti-Patterns

### ✅ DO

1. **Validate all inputs** on API routes

   ```ts
   const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
   const limit = Math.min(
     100,
     Math.max(1, parseInt(sp.get("limit") ?? "25", 10)),
   );
   ```

2. **Use `cn()` for conditional classes**

   ```tsx
   className={cn('base-class', active && 'active-class')}
   ```

3. **Fetch data in server components** when possible

   ```tsx
   // Server component
   const data = await getListings();
   return <ClientComponent data={data} />;
   ```

4. **Use `useSession()` hook in client components for auth checks**

   ```tsx
   const { data: session } = useSession();
   if (!session) return <Unauthorized />;
   ```

5. **Store complex state in URL params** for filterability

   ```
   /listings?make=BMW&model=3-Series&dealer=dealer1&page=2
   ```

6. **Export icons as objects, map them in nav arrays**
   ```tsx
   const navItems = [{ href: "/listings", label: "Listings", icon: CarIcon }];
   ```

### ❌ DON'T

1. **Don't mix snake_case and camelCase in JS** (use camelCase in JS; snake_case stays in SQL)

2. **Don't use boolean fields** without checking "0 vs 1" carefully

   ```ts
   // Bad: if (record.is_active)  — 0 is falsy but means false
   // Good: if (record.is_active === 1)
   ```

3. **Don't hardcode sorts or filters** — always validate against a whitelist

   ```ts
   const allowedSorts = ["last_edit", "current_price", "created_at"];
   if (!allowedSorts.includes(sort)) sort = "last_edit";
   ```

4. **Don't use async/await in better-sqlite3 queries** — it's synchronous

   ```ts
   // Good
   const results = raw.prepare(sql).all();

   // Bad
   const results = await raw.prepare(sql).all();
   ```

5. **Don't create large client bundles** — keep heavy logic in server routes or lib files

   ```ts
   // Instead of client-side filtering, let API do it
   const data = await fetch(`/api/listings?${params}`);
   ```

6. **Don't forget timestamp fields** — always include `created_at`, `updated_at`
   ```ts
   createdAt: text('created_at'),
   updatedAt: text('updated_at'),
   ```

## Scraping & External Integrations

### Starting the Scraper

1. **Via Dashboard:**
   - Go to the dashboard (`/`)
   - Look for "Mobile.bg Scraping" section
   - Click "Start Scraping" to go to Configuration

2. **Via Configuration Page:**
   - Navigate to `/config`
   - In "Scraping" section, select dealers to scrape (filters to "own" dealers by default)
   - Toggle "Deep crawl" if you want full listing details (slower but more thorough)
   - Click "Run" to start
   - Monitor the live log showing listings discovered and changes detected

3. **How it Works:**
   - Dispatches `POST /api/scrape` with selected dealer slugs and deepCrawl flag
   - Spawns server-side child process running `scraper/scripts/run-for-ui.ts`
   - Streams real-time updates via Server-Sent Events (SSE) with JSON log entries
   - Updates `listings` table with discovered cars
   - Records `listing_snapshots` for price/status changes
   - Creates `mobilebg_backup_runs` entry with run status

### Crawlee Integration

- Used for scrape ingestion and browser automation flows via `scraper/scripts/`
- Main script: `scraper/scripts/run-for-ui.ts` (spawned by API route)
- Entry script: `scraper/scripts/mobilebg-backup.ts` (core scraping logic)
- Scrape results populate `listings` as snapshot data
- Mobile.bg backup/edit/repost/update artifacts belong in the `mobilebg_*` tables
- Always handle rate limits, cookie banners, and slow transitions defensively

### Mobile.bg Draft / Backup / Sync

- `listings` is the scraped snapshot; do not write user edits back into it
- `mobilebg_backups` is the editable draft/source of truth for own listings
- Draft sync state lives on `mobilebg_backups`: `draft_needs_sync`, `last_mobile_sync_status`, `last_mobile_sync_error`, `last_mobile_sync_at`
- Mobile.bg repost and update flows use backup draft values plus captured structure from `mobilebg_edit_form_snapshots`
- If an update needs an edit-form snapshot and none exists, auto-capture it instead of failing hard
- Store Mobile.bg backup images locally under stable per-listing paths, not date-based folders
- Never store raw HTML long-term; persist structured fields, metadata, and screenshots instead

### Edit Own

- `/editown` edits own-listing drafts backed by `mobilebg_backups`
- Row `Sync` pushes one draft back to Mobile.bg
- `/editown/sync` is the batch sync page for changed drafts
- Batch sync should run sequentially for stability
- Show persistent statuses: `pending`, `running`, `success`, `failed`

## Testing & Verification

### Manual Testing

- Dev auto-login: use password `__dev_auto__` on login page
- Run `npm run dev` to start dev server (localhost:3000)
- Inspect live DB directly with `sqlite3 /Users/v/dev/scraped/listings.db`
- Inspect network requests in browser DevTools (API payloads & statuses)

### Database Migrations

- This repo currently uses hand-authored SQL migration scripts in `scripts/` for many schema changes
- Apply them carefully against the live SQLite DB and verify the resulting schema
- Always test migrations on a database backup when a change is destructive or backfills data

## Dev Workflow Tips

### Quick Commands

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run lint             # Run ESLint
sqlite3 /Users/v/dev/scraped/listings.db
```

### Debugging

- Browser DevTools: inspect Network tab for API responses
- Terminal: check console logs for server errors
- Database: use `sqlite3` or targeted scripts to inspect tables & records directly
- NextAuth: check request/response headers for auth cookies

### Code Quality

- Use TypeScript strict mode (no `any`)
- Keep components under 200 lines; break into smaller pieces
- Extract repeated logic into utility functions
- Use meaningful variable names over comments

## Common Gotchas

1. **Integer booleans:** SQLite stores `0`/`1`; always check `=== 1` for true
2. **Snapshot vs draft:** `listings` is snapshot data; editable own-listing state belongs in `mobilebg_backups`
3. **Pagination:** API expects `page` (1-indexed), not offset
4. **Date parsing:** prefer shared formatting helpers
5. **Image URLs:** use shared image builders from `lib/utils.ts`; do not handcraft old Mobile.bg thumbnail URLs
6. **Bracket routes in shell:** quote paths like `app/api/listings/[mobileId]/route.ts`
7. **Session changes:** after login/logout, redirect to refresh session

## Updating This File

**Process:** When you discover a pattern, mistake, or best practice:

1. Document it in this file
2. Commit with message: `docs: update CLAUDE.md — [brief description]`

This keeps institutional knowledge in one place and helps all Claude sessions stay consistent.
