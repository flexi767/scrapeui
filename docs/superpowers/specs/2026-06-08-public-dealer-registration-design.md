# Public Dealer Registration & Per-User Page Permissions

## Summary

Today, only an admin can create a dealer account (`/dealers/register` → `/api/dealers/register`, admin-only). This adds a **public, unauthenticated registration flow** so prospective dealers can sign themselves up (choose username/password, provide an email, and land in the admin area immediately as a `role: 'user'` account tied to a new dealer). Alongside it, we introduce a **per-user page-permission system** so admins can control exactly which sections of the admin UI each individual user can see — since self-registered dealers should see a much smaller subset of pages than admins (or than today's manually-created users).

## Goals

- Anyone can register a new dealer from a public page without being logged in.
- Registration collects: dealer name, slug, mobile.bg URL, "own listing" flag, priority, username, password, and **email**.
- No email confirmation step (out of scope — email is stored for record-keeping only).
- After registering, the user is signed in immediately and lands in the admin UI.
- Newly self-registered users see only **Dashboard** and **Edit Own** by default.
- Admins can grant/revoke individual page access per user from an admin screen.
- Permissions are enforced at three layers: sidebar navigation, page access, and API routes.
- Existing non-admin users are unaffected — they keep seeing everything they see today.

## Non-goals

- Email verification / confirmation links (explicitly skipped per user decision).
- Per-dealer (shared) permissions — this is per-user.
- Admin approval queue for new registrations — registration is instant/self-serve.
- Changing how admin-side dealer registration (`/dealers/register`) works.

## Data model changes

### `users` table — add `email`

```ts
email: text('email').unique(),
```

Nullable (existing users won't have one); unique when present. Add via a hand-authored migration script in `scripts/`, following the existing pattern for schema changes in this repo.

### New table: `user_page_permissions`

```ts
export const userPagePermissions = sqliteTable('user_page_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  pageKey: text('page_key').notNull(),
  createdAt: text('created_at'),
}, (table) => ({
  uniq: uniqueIndex('user_page_permissions_user_page_idx').on(table.userId, table.pageKey),
}));
```

One row = one page the user can see. **Admins are exempt** — no rows are consulted for `role === 'admin'` users; they always see everything. For non-admin users, having zero rows means seeing nothing (except always-visible pages, see below).

### Page key enum

A fixed list of keys mirroring the top-level nav sections in `AppSidebar.tsx`, defined once in `lib/page-permissions.ts` as the single source of truth (used by the sidebar filter, the page guard, the API guard, and the admin checkbox UI):

```
dashboard, listings, editown, mobilebg, tasks, expenses,
templates, translations, config, mapping, kb, files, dealers
```

`dashboard` is **always visible** to every authenticated user regardless of permissions (it's the landing page after login) — it is not stored as a grantable/revocable row, just always allowed.

### Backfill migration

A script in `scripts/` that, for every existing user with `role !== 'admin'`, inserts a permission row for **every** page key. This preserves current behavior for all pre-existing accounts. New self-registrations do NOT go through this — they get only the small default set seeded at creation time (see below).

## Registration flow

### Public page: `/register`

New route at `app/[locale]/(public)/register/page.tsx` (public route group, no auth required — mirrors how `(public)/d` and `(public)/facebook-marketplace` work).

Form fields — same as the existing admin registration form (`app/[locale]/(app)/dealers/register/page.tsx`) plus email:
- Dealer name (required) → auto-generates slug via `slugifyDealerName`, slug editable
- Slug (required, validated with `isValidDealerSlug`)
- Mobile.bg listing URL (optional)
- "Own listing we manage" checkbox
- Priority (number)
- Username (required)
- Password (required, min 6 chars)
- **Email (required, validated as an email format)**

On submit: POST to `/api/dealers/self-register`, then call `signIn('credentials', ...)` with the chosen username/password to establish a session, then redirect to `/dashboard`.

### API route: `POST /api/dealers/self-register`

New route at `app/api/dealers/self-register/route.ts`. **No auth check** (public). Otherwise closely mirrors `/api/dealers/register`:

- Validates all fields (name, slug, username, password, email — same rules as admin route, plus a basic email-format check).
- Runs the same transaction: insert `dealers` row, insert `users` row with `role: 'user'`, `dealer_id`, and the new `email` field.
- **Additionally**, within the same transaction, seeds `user_page_permissions` rows for the new user with `pageKey IN ('editown')` (`dashboard` doesn't need a row since it's always-on).
- Returns `{ id, slug, name }` like the admin route; client then signs in and redirects — no "credentials" detail page redirect (that's an admin-only follow-up step today).
- Same uniqueness error handling (slug/username/email collisions → 409).

### Login page link

`app/[locale]/login/page.tsx` gets a small "Register as a dealer" link pointing to `/register`, placed below the login form.

## Permission enforcement

A single helper module, `lib/page-permissions.ts`, exports:

- `PAGE_KEYS` — the const array of valid keys (source of truth for the enum, the admin checkbox list, etc.)
- `ALWAYS_VISIBLE_KEYS` — `['dashboard']`
- `getUserPageKeys(userId, role): string[]` — returns the full `PAGE_KEYS` list for admins, or `ALWAYS_VISIBLE_KEYS` plus whatever's in `user_page_permissions` for non-admins. Implemented with a direct `raw.prepare(...)` query (per repo convention — synchronous better-sqlite3).
- `userCanSeePage(session, pageKey): boolean` — convenience check used by guards below.

### Layer 1 — Sidebar (`components/AppSidebar.tsx`)

Filter `navItems` and `sectionItems` down to entries whose `match`/section `id` maps to a permitted page key. We extend the session/JWT with a `pageKeys: string[]` field (alongside the existing `role`, `username`, `dealerId`), populated by `getUserPageKeys()` at `authorize()` time in `lib/auth.ts` and threaded through the `jwt`/`session` callbacks in `lib/auth.config.ts`. Admins get the full `PAGE_KEYS` array. This lets `AppSidebar` (and any other client component) filter using only `useSession()` — no extra fetch, and it naturally refreshes on next login/session refresh, consistent with how `role`/`dealerId` already work.

### Layer 2 — Page guard

A small server-side helper, `requirePagePermission(pageKey)` in `lib/api/auth-helpers.ts` (alongside `requireAuth`/`requireAdmin`), used at the top of each gated server-component page:

```ts
const check = await requirePagePermission('mobilebg');
if ('redirect' in check) redirect('/dashboard'); // or render a "no access" message
```

Applied to the top-level `page.tsx` of each gated section (`listings`, `editown`, `mobilebg`, `tasks`, `expenses`, `templates`, `translations`, `mapping`, `kb`, `files`, `dealers`; `config` stays admin-only via existing `requireAdmin`).

### Layer 3 — API routes

An API-route variant, `requireApiPagePermission(pageKey)`, returning `{ error: NextResponse }` with status 403 (mirrors `requireAdmin`'s shape), used in the route handlers that back each gated section's data (e.g. `/api/listings`, `/api/editown/*`, `/api/mobilebg/*`, `/api/tasks/*`, etc.). This is applied incrementally to the routes that exist today and matter most — not a mechanical sweep of every single API file, but every route that serves a gated page's primary data.

## Admin permission management UI

New page: `app/[locale]/(app)/dealers/[id]/users/[userId]/permissions/page.tsx` (or simpler: a permissions panel added to the existing user/dealer credential screens — exact placement to be decided in the implementation plan, but logically it's "edit a specific user's page access").

- Admin-only (`requireAdmin`).
- Renders a checkbox per `PAGE_KEYS` entry (translated labels matching the sidebar's existing nav labels), pre-checked according to the user's current `user_page_permissions` rows.
- `dashboard` is shown but disabled/always-checked (always visible, not revocable).
- Saves via `PUT /api/users/[id]/permissions` (admin-only): replaces the user's permission rows with the submitted set in a transaction (delete-all + re-insert, or diff — implementation detail).

## Error handling & edge cases

- Slug/username/email collisions on `/api/dealers/self-register` → `409` with a generic "already exists" message (don't leak which field collided, to avoid username/email enumeration).
- A non-admin user with zero permission rows still sees `dashboard` (never a fully blank app).
- Visiting a gated page directly without permission → redirect to `/dashboard` (consistent with how `requireAdmin`-gated pages currently behave, e.g. `translations`).
- Calling a gated API route without permission → `403 Forbidden`, same shape as `requireAdmin`'s error response.
- Existing non-admin users: migration grants them every page key, so their experience is unchanged on deploy day. Admins can subsequently tighten their access through the same permissions UI.

## Testing & verification

- Manual: register a new dealer via `/register` while logged out, confirm immediate sign-in and that the sidebar shows only Dashboard + Edit Own.
- Manual: as admin, open the new user's permissions screen, grant `listings`, save, confirm the sidebar updates on next login/session refresh and the `/listings` page becomes reachable.
- Manual: as the restricted user, attempt to navigate directly to a non-permitted page URL and call its API — confirm redirect/403 respectively.
- Manual: confirm an existing pre-migration non-admin user still sees the full sidebar after the backfill runs.
- `npm run lint` and `npm run build` to catch type errors (strict TS, new schema fields/types).
