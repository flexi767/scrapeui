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
  (app)/            # Protected routes (require auth)
  login/            # Auth page
  editown/          # Related to cars.bg editown sync
components/         # Reusable React components
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
- **listings:** car listings with mobile.bg & cars.bg sync status
- **listing_snapshots:** price/status history for tracking changes
- **tasks:** todo items with subtasks, dependencies, comments
- **users, labels, expenses, articles, notifications**

### Query Patterns
- All business logic queries live in `lib/queries.ts`
- Export functions like `getListings()`, `createTask()`, etc.
- Use synchronous `better-sqlite3` (not async)
- Always validate input parameters (page, limit, sort fields)

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
- **AppSidebar:** main navigation with nav items (routes & icons)
- **TopBar:** header with user menu
- **SessionProvider:** wraps app for NextAuth context
- **Editor components:** TipTapEditor, TiptapViewer, TiptapToolbar for rich text

## API Routes

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
   const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
   const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '25', 10)));
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
   const navItems = [
     { href: '/listings', label: 'Listings', icon: CarIcon },
   ];
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
   const allowedSorts = ['last_edit', 'current_price', 'created_at'];
   if (!allowedSorts.includes(sort)) sort = 'last_edit';
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

### Crawlee Integration
- Used for browser automation (mobile.bg, cars.bg)
- Entry points: `app/api/scrape/` routes
- Always handle rate limits and timeouts
- Store results in `listings` or `listing_snapshots` table

### mobile.bg & cars.bg Sync
- **mobile.bg:** source data (dealer credentials in `dealers` table)
- **cars.bg:** "EditOwn" destination (sync via user credentials, store `cars_id`, `cars_synced_at`)
- Track sync status: `needs_sync`, `cars_synced_at` fields
- Never store raw HTML; parse into structured fields

## Testing & Verification

### Manual Testing
- Dev auto-login: use password `__dev_auto__` on login page
- Run `npm run dev` to start dev server (localhost:3000)
- Check database with `npm run drizzle-studio` (Drizzle Studio on localhost:5555)
- Inspect network requests in browser DevTools (API payloads & statuses)

### Database Migrations
- Use Drizzle Kit: `drizzle-kit generate` → `npm run migrate` in scripts
- Migrations live in `drizzle/` directory
- Always test migrations on a database backup

## Dev Workflow Tips

### Quick Commands
```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run lint             # Run ESLint
npm run drizzle-studio  # Open Drizzle Studio (DB explorer)
```

### Debugging
- Browser DevTools: inspect Network tab for API responses
- Terminal: check console logs for server errors
- Database: use Drizzle Studio to inspect tables & records directly
- NextAuth: check request/response headers for auth cookies

### Code Quality
- Use TypeScript strict mode (no `any`)
- Keep components under 200 lines; break into smaller pieces
- Extract repeated logic into utility functions
- Use meaningful variable names over comments

## Common Gotchas

1. **Integer booleans:** SQLite stores `0`/`1`; always check `=== 1` for true
2. **Pagination:** API expects `page` (1-indexed), not offset
3. **Date parsing:** ISO strings work; use `date-fns` for formatting
4. **Form submissions:** form data comes as `FormData` in API routes
5. **Session changes:** after login/logout, redirect to refresh session
6. **SVG paths:** Lucide icons are pre-built; don't create custom SVGs in code

## Updating This File

**Process:** When you discover a pattern, mistake, or best practice:
1. Document it in this file
2. Commit with message: `docs: update CLAUDE.md — [brief description]`

This keeps institutional knowledge in one place and helps all Claude sessions stay consistent.
