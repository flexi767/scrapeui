# Public Dealer Registration & Per-User Page Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let prospective dealers self-register a public account (no login required) and give admins per-user control over which admin-UI pages each user can see, enforced in the sidebar, on pages, and in API routes.

**Architecture:** A new `email` column on `users` plus a `user_page_permissions` table backs a single source-of-truth module (`lib/page-permissions.ts`) that both the session/JWT and the UI/API guards consult. Registration reuses the existing admin dealer-creation transaction pattern via a new public, unauthenticated API route. Enforcement is layered: filtered sidebar nav (via `pageKeys` baked into the session), server-side page guards, and API route guards — all driven by the same `PAGE_KEYS` constant.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Drizzle ORM schema + raw `better-sqlite3` queries, NextAuth v5 (JWT sessions), Tailwind/shadcn UI, no test framework (this repo verifies via `npm run lint`, `npm run build`, and manual testing per `CLAUDE.md`).

This repo has no unit-test framework — verification steps below use `npm run lint`, `npm run build`, `curl` against the dev server, and manual browser checks (the existing project convention per `CLAUDE.md`'s "Manual Testing" section), instead of `pytest`/`jest`-style automated tests.

---

### Task 1: Add `email` column to `users` and create `user_page_permissions` table

**Files:**
- Create: `scripts/migrate-user-permissions.sql`
- Modify: `db/schema.ts` (users table block, currently lines 107-115; add new table after `dealerTemplateConfigs`, currently ending around line 124)

- [ ] **Step 1: Write the migration SQL**

Create `scripts/migrate-user-permissions.sql`:

```sql
-- scripts/migrate-user-permissions.sql

-- Add email to users (nullable; existing accounts won't have one)
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email) WHERE email IS NOT NULL;

-- Per-user page visibility grants
CREATE TABLE IF NOT EXISTS user_page_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  page_key TEXT NOT NULL,
  created_at TEXT,
  UNIQUE(user_id, page_key)
);

-- Backfill: existing non-admin users keep seeing everything they see today.
-- (dashboard is always-visible and intentionally NOT inserted here.)
INSERT OR IGNORE INTO user_page_permissions (user_id, page_key, created_at)
SELECT u.id, k.page_key, CURRENT_TIMESTAMP
FROM users u
CROSS JOIN (
  SELECT 'listings' AS page_key UNION ALL
  SELECT 'editown' UNION ALL
  SELECT 'mobilebg' UNION ALL
  SELECT 'tasks' UNION ALL
  SELECT 'expenses' UNION ALL
  SELECT 'templates' UNION ALL
  SELECT 'translations' UNION ALL
  SELECT 'config' UNION ALL
  SELECT 'mapping' UNION ALL
  SELECT 'kb' UNION ALL
  SELECT 'files' UNION ALL
  SELECT 'dealers'
) k
WHERE u.role != 'admin';
```

- [ ] **Step 2: Apply the migration to the live database**

Run: `sqlite3 /Users/v/dev/scraped/listings.db < scripts/migrate-user-permissions.sql`

Expected: no output (statements succeed silently). Verify with:

```bash
sqlite3 /Users/v/dev/scraped/listings.db ".schema user_page_permissions"
sqlite3 /Users/v/dev/scraped/listings.db "SELECT COUNT(*) FROM user_page_permissions;"
sqlite3 /Users/v/dev/scraped/listings.db "PRAGMA table_info(users);" | grep email
```
Expected: the table schema prints, the count is `(number of non-admin users) * 12`, and `email` appears in the `users` column list.

- [ ] **Step 3: Add the Drizzle schema definitions**

In `db/schema.ts`, modify the `users` table (around line 107-115) to add the `email` column:

```ts
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: text("created_at"),
  dealerId: integer("dealer_id").references(() => dealers.id),
});
```

Then add a new table definition directly after the `dealerTemplateConfigs` block (after its closing `});`):

```ts
export const userPagePermissions = sqliteTable("user_page_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  pageKey: text("page_key").notNull(),
  createdAt: text("created_at"),
});
```

Also add a type export near the existing `export type User = typeof users.$inferSelect;` (around line 587):

```ts
export type UserPagePermission = typeof userPagePermissions.$inferSelect;
```

- [ ] **Step 4: Verify the project still builds**

Run: `npm run lint`
Expected: no new errors related to `db/schema.ts`.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-user-permissions.sql db/schema.ts
git commit -m "feat: add email column and user_page_permissions table"
```

---

### Task 2: Create `lib/page-permissions.ts` — the single source of truth for page keys

**Files:**
- Create: `lib/page-permissions.ts`

- [ ] **Step 1: Write the module**

Create `lib/page-permissions.ts`:

```ts
import { raw } from '@/db/client';

export const PAGE_KEYS = [
  'listings',
  'editown',
  'mobilebg',
  'tasks',
  'expenses',
  'templates',
  'translations',
  'config',
  'mapping',
  'kb',
  'files',
  'dealers',
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export function isPageKey(value: string): value is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(value);
}

// Always visible to every authenticated user, regardless of grants.
export const ALWAYS_VISIBLE_KEYS = ['dashboard'] as const;

interface PermissionRow {
  page_key: string;
}

/**
 * Returns the set of page keys a user is allowed to see.
 * Admins always get every key; everyone else gets the always-visible
 * keys plus whatever has been explicitly granted in user_page_permissions.
 */
export function getUserPageKeys(userId: number, role: string): string[] {
  if (role === 'admin') {
    return [...ALWAYS_VISIBLE_KEYS, ...PAGE_KEYS];
  }

  const rows = raw
    .prepare('SELECT page_key FROM user_page_permissions WHERE user_id = ?')
    .all(userId) as PermissionRow[];

  return [...ALWAYS_VISIBLE_KEYS, ...rows.map((row) => row.page_key)];
}

export function userHasPageKey(pageKeys: string[] | undefined, key: PageKey): boolean {
  return Array.isArray(pageKeys) && pageKeys.includes(key);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no errors in `lib/page-permissions.ts`.

- [ ] **Step 3: Manually verify the query against the live DB**

Run:
```bash
sqlite3 /Users/v/dev/scraped/listings.db "SELECT id, role FROM users LIMIT 3;"
```
Pick a non-admin user id from the output (call it `<uid>`) and confirm:
```bash
sqlite3 /Users/v/dev/scraped/listings.db "SELECT page_key FROM user_page_permissions WHERE user_id = <uid>;"
```
Expected: 12 rows (the full backfilled set from Task 1).

- [ ] **Step 4: Commit**

```bash
git add lib/page-permissions.ts
git commit -m "feat: add page-permissions module with PAGE_KEYS source of truth"
```

---

### Task 3: Thread `pageKeys` through the session/JWT

**Files:**
- Modify: `lib/auth.ts` (type declarations near top, and the `authorize` return value)
- Modify: `lib/auth.config.ts` (`jwt` and `session` callbacks)

- [ ] **Step 1: Extend the module type declarations in `lib/auth.ts`**

Update the `declare module 'next-auth'` and `declare module '@auth/core/jwt'` blocks at the top of `lib/auth.ts`:

```ts
declare module 'next-auth' {
  interface User {
    role?: string;
    username?: string;
    dealerId?: number | null;
    pageKeys?: string[];
  }
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      role: string;
      dealerId: number | null;
      pageKeys: string[];
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: string;
    username: string;
    dealerId: number | null;
    pageKeys: string[];
  }
}
```

- [ ] **Step 2: Populate `pageKeys` in `authorize()`**

In `lib/auth.ts`, the `authorize` callback currently ends with:

```ts
        return {
          id: String(user.id),
          name: user.name,
          username: user.username,
          role: user.role,
          dealerId: user.dealer_id ?? null,
        };
```

Add the import at the top of the file (alongside the existing `import { raw } from '@/db/client';`):

```ts
import { getUserPageKeys } from '@/lib/page-permissions';
```

And change the return statement to:

```ts
        return {
          id: String(user.id),
          name: user.name,
          username: user.username,
          role: user.role,
          dealerId: user.dealer_id ?? null,
          pageKeys: getUserPageKeys(user.id, user.role),
        };
```

- [ ] **Step 3: Propagate `pageKeys` through the JWT/session callbacks**

In `lib/auth.config.ts`, update the `jwt` callback:

```ts
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role?: string }).role ?? 'user';
        token.username = (user as { username?: string }).username ?? '';
        token.dealerId = (user as { dealerId?: number | null }).dealerId ?? null;
        token.pageKeys = (user as { pageKeys?: string[] }).pageKeys ?? [];
      }
      return token;
    },
```

And the `session` callback:

```ts
    session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as unknown as Record<string, unknown>).role = token.role;
      (session.user as unknown as Record<string, unknown>).username = token.username;
      (session.user as unknown as Record<string, unknown>).dealerId = token.dealerId ?? null;
      (session.user as unknown as Record<string, unknown>).pageKeys = token.pageKeys ?? [];
      return session;
    },
```

- [ ] **Step 4: Verify the project builds and you can log in**

Run: `npm run lint`
Expected: no new type errors.

Then start the dev server (`npm run dev`), log in (dev auto-login uses `__dev_auto__`, or use the credentials form), open the browser devtools console and run:
```js
fetch('/api/auth/session').then(r => r.json()).then(console.log)
```
Expected: the JSON response includes `user.pageKeys` as an array (full `PAGE_KEYS` + `dashboard` for an admin).

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.config.ts
git commit -m "feat: include pageKeys in session and JWT"
```

---

### Task 4: Add `requirePagePermission` / `requireApiPagePermission` guards

**Files:**
- Modify: `lib/api/auth-helpers.ts`

- [ ] **Step 1: Add the guards**

Append to `lib/api/auth-helpers.ts` (it currently exports `requireAuth` and `requireAdmin`):

```ts
import { isPageKey, userHasPageKey, type PageKey } from '@/lib/page-permissions';

type PageAuthOk = { session: Session };
type PageAuthErr = { redirect: string };

/**
 * Server-component page guard. Returns `{ session }` when the signed-in
 * user may see `pageKey`, or `{ redirect: '/dashboard' }` otherwise.
 * Admins always pass.
 */
export async function requirePagePermission(pageKey: PageKey): Promise<PageAuthOk | PageAuthErr> {
  const session = await auth();
  if (!session?.user) {
    return { redirect: '/login' };
  }
  if (session.user.role === 'admin') {
    return { session: session as Session };
  }
  if (!userHasPageKey(session.user.pageKeys, pageKey)) {
    return { redirect: '/dashboard' };
  }
  return { session: session as Session };
}

/**
 * API route guard mirroring requireAdmin's shape: returns `{ session }`
 * or `{ error: NextResponse }` (401/403). Admins always pass.
 */
export async function requireApiPagePermission(pageKey: PageKey): Promise<AuthOk | AuthErr> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role === 'admin') {
    return { session: session as Session };
  }
  if (!userHasPageKey(session.user.pageKeys, pageKey)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session: session as Session };
}

export { isPageKey };
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no errors. (The `Session`, `NextResponse`, `AuthOk`, `AuthErr`, and `auth` symbols are already imported/defined earlier in this file — confirm the import for `isPageKey`/`userHasPageKey`/`PageKey` is the only new one needed.)

- [ ] **Step 3: Commit**

```bash
git add lib/api/auth-helpers.ts
git commit -m "feat: add page-permission guards for pages and API routes"
```

---

### Task 5: Public self-registration API route

**Files:**
- Create: `app/api/dealers/self-register/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/dealers/self-register/route.ts`, closely modeled on `app/api/dealers/register/route.ts` but with no auth check, an email field/validation, and permission-row seeding:

```ts
import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { isValidDealerSlug } from '@/lib/dealer-config';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';
import { errorMessage } from '@/lib/utils';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_GRANTED_PAGE_KEYS = ['editown'];

// POST /api/dealers/self-register
// Public, unauthenticated: a prospective dealer creates their own
// dealer + user account and is signed in immediately afterwards.
export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  const {
    name, slug, mobile_url,
    own = false, priority = 0,
    username, password, email,
  } = body as {
    name: string; slug: string; mobile_url?: string;
    own?: boolean; priority?: number;
    username: string; password: string; email: string;
  };

  if (!name?.trim() || !slug?.trim() || !username?.trim() || !password?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'name, slug, username, password and email are required' }, { status: 400 });
  }
  if (!isValidDealerSlug(slug)) {
    return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
  }
  if ((password as string).length < 6) {
    return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test((email as string).trim())) {
    return NextResponse.json({ error: 'a valid email address is required' }, { status: 400 });
  }

  const now = currentIsoTimestamp();
  const passwordHash = await bcrypt.hash(password as string, 10);

  const insert = raw.transaction(() => {
    const dealerResult = runInsert(raw, 'dealers', {
      slug,
      name: name.trim(),
      mobile_url: (mobile_url as string) || null,
      own: own ? 1 : 0,
      active: 1,
      priority,
      created_at: now,
    });

    const dealerId = dealerResult.lastInsertRowid as number;

    const userResult = runInsert(raw, 'users', {
      username: (username as string).trim(),
      name: (name as string).trim(),
      email: (email as string).trim(),
      password_hash: passwordHash,
      role: 'user',
      dealer_id: dealerId,
      created_at: now,
    });

    const userId = userResult.lastInsertRowid as number;

    for (const pageKey of DEFAULT_GRANTED_PAGE_KEYS) {
      runInsert(raw, 'user_page_permissions', {
        user_id: userId,
        page_key: pageKey,
        created_at: now,
      });
    }

    return dealerId;
  });

  try {
    const dealerId = insert();
    return NextResponse.json({ id: dealerId, slug, name }, { status: 201 });
  } catch (err) {
    const msg = errorMessage(err, '');
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'slug, username or email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'registration failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manually exercise the route end to end**

Start the dev server (`npm run dev` if not already running) and run:

```bash
curl -s -X POST http://localhost:3000/api/dealers/self-register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Self Dealer","slug":"test-self-dealer","username":"testselfdealer","password":"password123","email":"selfdealer@example.com"}'
```

Expected: `{"id":<n>,"slug":"test-self-dealer","name":"Test Self Dealer"}` with HTTP 201.

Then verify the seeded permission rows:
```bash
sqlite3 /Users/v/dev/scraped/listings.db "SELECT u.username, p.page_key FROM users u JOIN user_page_permissions p ON p.user_id = u.id WHERE u.username = 'testselfdealer';"
```
Expected: exactly one row — `testselfdealer|editown`.

Re-run the same `curl` command a second time:
Expected: `{"error":"slug, username or email already exists"}` with HTTP 409.

- [ ] **Step 4: Commit**

```bash
git add app/api/dealers/self-register/route.ts
git commit -m "feat: add public dealer self-registration API route"
```

---

### Task 6: Public registration page at `/register`

**Files:**
- Create: `app/[locale]/(public)/register/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/[locale]/(public)/register/page.tsx`, adapted from `app/[locale]/(app)/dealers/register/page.tsx`: same fields plus email, no admin gate, posts to `/api/dealers/self-register`, then signs in and redirects to `/dashboard`.

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import Link from 'next/link';
import { slugifyDealerName } from '@/components/dealers/utils';
import { apiRequest, errorMessage } from '@/lib/utils';

export default function PublicRegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    mobile_url: '',
    username: '',
    password: '',
    email: '',
    own: false,
    priority: 0,
  });
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string | boolean | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleNameChange(v: string) {
    set('name', v);
    if (!slugManual) set('slug', slugifyDealerName(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.name.trim() || !form.slug.trim() ||
      !form.username.trim() || !form.password.trim() || !form.email.trim()
    ) {
      toast.error('Name, slug, username, password and email are required');
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<{ id?: number }>('/api/dealers/self-register', 'Registration failed', {
        method: 'POST',
        json: form,
      });
      if (!data.id) {
        toast.error('Registration failed');
        return;
      }

      const signInResult = await signIn('credentials', {
        username: form.username,
        password: form.password,
        redirect: false,
      });
      if (signInResult?.error) {
        toast.success('Account created — please log in');
        router.push('/login');
        return;
      }

      toast.success(`Welcome, ${form.name}!`);
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'Registration failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/login" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            ← Login
          </Link>
          <span className="text-sm font-medium text-gray-400">Register as a dealer</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-100 mb-6">Create your dealer account</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Dealer info</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Dealer / company name</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="M Motors"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Slug <span className="text-gray-500 text-xs">(used in public URLs)</span></label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500 font-mono"
                value={form.slug}
                onChange={(e) => { setSlugManual(true); set('slug', e.target.value); }}
                placeholder="m-motors"
                pattern="[a-z0-9-]+"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Mobile.bg listing URL</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.mobile_url}
                onChange={(e) => set('mobile_url', e.target.value)}
                placeholder="https://www.mobile.bg/pcgi/mobile.cgi?act=3&slink=..."
                type="url"
              />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-600"
                  checked={form.own}
                  onChange={(e) => set('own', e.target.checked)}
                />
                This is my own listing inventory
              </label>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Priority</label>
                <input
                  type="number"
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                  value={form.priority}
                  onChange={(e) => set('priority', Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>
          </section>

          <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Account</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Password <span className="text-gray-500 text-xs">(min. 6 characters)</span></label>
              <input
                type="password"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded px-4 py-2.5 transition-colors"
          >
            {saving ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manually verify in the browser**

With the dev server running, open `http://localhost:3000/en/register` (logged out — use a private/incognito window so you don't have an existing session). Fill in the form with a fresh slug/username/email (e.g. `Browser Test Dealer` / `browsertestdealer` / `browsertest@example.com`, password `password123`) and submit.

Expected: you land on `/dashboard` signed in as the new user, and:
```bash
sqlite3 /Users/v/dev/scraped/listings.db "SELECT username, email, role, dealer_id FROM users WHERE username = 'browsertestdealer';"
```
shows the new row with the email populated and `role = 'user'`.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(public)/register/page.tsx"
git commit -m "feat: add public dealer self-registration page"
```

---

### Task 7: Link to `/register` from the login page

**Files:**
- Modify: `app/[locale]/login/page.tsx`

- [ ] **Step 1: Add the link**

In `app/[locale]/login/page.tsx`, find the closing `</form>` (or the end of the main card markup, just before the component's closing `</div>`/`</main>` wrapper) and add a link below it:

```tsx
        <p className="mt-4 text-center text-sm text-gray-400">
          New dealer?{' '}
          <a href="/register" className="text-blue-400 hover:text-blue-300 underline">
            Register as a dealer
          </a>
        </p>
```

(Use a plain `<a>` rather than Next's `Link` here — the login page is rendered for unauthenticated visits and `/register` lives in a different route group/layout, so a full navigation is simplest and matches how this page already keeps things minimal.)

Read the file first to find the exact closing tag to anchor this against — the surrounding JSX structure (card wrapper, form, error message placement) determines where the paragraph reads naturally, typically right after the submit button and before the closing wrapper `</div>`.

- [ ] **Step 2: Verify it compiles and renders**

Run: `npm run lint`, then open `http://localhost:3000/en/login` in a private window.
Expected: a "New dealer? Register as a dealer" line appears below the login form, and clicking it navigates to `/register`.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/login/page.tsx"
git commit -m "feat: link to dealer registration from the login page"
```

---

### Task 8: Filter the sidebar by `pageKeys`

**Files:**
- Modify: `components/AppSidebar.tsx`

- [ ] **Step 1: Read the current file in full**

Read `components/AppSidebar.tsx` to see the exact `navItems`/`sectionItems` array structure and the JSX that renders them (the earlier exploration showed `navItems` has `{ href, label, icon, match }` and `sectionItems` has `{ id, match, links }`).

- [ ] **Step 2: Map nav entries to page keys and filter**

Add a mapping from each nav/section entry to its `PageKey` (or `null` for always-visible items like dashboard), then filter both arrays using `session?.user?.pageKeys` before rendering. Concretely, just below the `const { data: session } = useSession();` line, add:

```ts
import { PAGE_KEYS, type PageKey } from '@/lib/page-permissions';
```//  add this to the existing import block at the top of the file

// ... inside the component, after `const { data: session } = useSession();`:
const role = session?.user?.role;
const pageKeys = session?.user?.pageKeys;

function isVisible(key: PageKey | null): boolean {
  if (key === null) return true; // always-visible (e.g. dashboard)
  if (role === 'admin') return true;
  if (!pageKeys) return false; // session not loaded yet — render nothing extra
  return (pageKeys as string[]).includes(key);
}
```

Then attach a `pageKey: PageKey | null` to every entry in `navItems` and `sectionItems`, e.g.:

```ts
const navItems = [
  { href: '/dashboard', label: t('dashboard'), icon: DashboardIcon, match: ['/dashboard'], pageKey: null },
  { href: '/listings', label: t('listings'), icon: CarIcon, match: ['/listings'], pageKey: 'listings' },
  { href: '/editown', label: t('edit_own'), icon: EditIcon, match: ['/editown', '/facebook-marketplace'], pageKey: 'editown' },
  { href: '/mobilebg', label: t('mobile_bg'), icon: ArchiveIcon, match: ['/mobilebg'], pageKey: 'mobilebg' },
  { href: '/tasks', label: t('tasks'), icon: TaskIcon, match: ['/tasks'], pageKey: 'tasks' },
  { href: '/expenses', label: t('expenses'), icon: ExpenseIcon, match: ['/expenses'], pageKey: 'expenses' },
  { href: '/templates', label: t('templates'), icon: TemplateIcon, match: ['/templates'], pageKey: 'templates' },
  { href: '/translations', label: 'Translations', icon: TranslateIcon, match: ['/translations'], pageKey: 'translations' },
  { href: '/config', label: t('config'), icon: GearIcon, match: ['/config', '/dealers'], pageKey: 'config' },
] satisfies Array<{ href: string; label: string; icon: unknown; match: string[]; pageKey: PageKey | null }>;
```

(Apply the same `pageKey` field to each `sectionItems` entry: `listings` → `'listings'`, `editown` → `'editown'`, `mobilebg` → `'mobilebg'`, `tasks` → `'tasks'`, `workspace` → use `'mapping'` for the section's own visibility check since `mapping`/`kb`/`files` are siblings — see Step 3 for the more granular per-link approach.)

- [ ] **Step 3: Filter at render time**

Where `navItems.map(...)` is invoked, wrap it in a `.filter((item) => isVisible(item.pageKey))` before mapping:

```tsx
{navItems.filter((item) => isVisible(item.pageKey)).map((item) => {
```

For `sectionItems`, since the `workspace` section bundles three independently-keyed links (`mapping`, `kb`, `files`), give each link inside `links` its own `pageKey` and filter the inner list too:

```ts
{
  id: 'workspace',
  match: ['/mapping', '/kb', '/files'],
  links: [
    { href: '/mapping', label: t('mapping'), icon: MapIcon, pageKey: 'mapping' },
    { href: '/kb', label: t('knowledge_base'), icon: BookIcon, pageKey: 'kb' },
    { href: '/files', label: t('files'), icon: FileIcon, pageKey: 'files' },
  ],
},
```

Then, wherever `activeSection.links.map(...)` (or equivalent) renders the secondary nav, filter first: `activeSection.links.filter((link) => isVisible(link.pageKey)).map(...)`. Also filter `sectionItems` itself before computing `activeSection` so a fully-hidden section doesn't show as "active": `sectionItems.filter((section) => section.links.some((l) => isVisible(l.pageKey)))`.

For `editown`, `mobilebg`, `listings`, `tasks` sections (whose links all share one `pageKey`), set every link's `pageKey` to that section's key (e.g. all `editown` section links get `pageKey: 'editown'`).

- [ ] **Step 4: Verify visually as both an admin and a restricted user**

With the dev server running:
1. Log in as an admin (dev auto-login). Confirm the sidebar shows every nav item exactly as before (no regressions).
2. In a private window, log in as the `browsertestdealer` user created in Task 6 (or the `testselfdealer` one from Task 5 — set its password via `UPDATE users SET password_hash = ... WHERE username = ...` if needed, or just re-register a fresh one). Confirm the sidebar shows **only** Dashboard and Edit Own (plus its sub-links).

- [ ] **Step 5: Commit**

```bash
git add components/AppSidebar.tsx
git commit -m "feat: filter sidebar navigation by user page permissions"
```

---

### Task 9: Gate each restricted page with `requirePagePermission`

**Files:**
- Modify: `app/[locale]/(app)/listings/page.tsx`
- Modify: `app/[locale]/(app)/editown/page.tsx`
- Modify: `app/[locale]/(app)/mobilebg/page.tsx`
- Modify: `app/[locale]/(app)/tasks/page.tsx`
- Modify: `app/[locale]/(app)/expenses/page.tsx`
- Modify: `app/[locale]/(app)/templates/page.tsx`
- Modify: `app/[locale]/(app)/mapping/page.tsx`
- Modify: `app/[locale]/(app)/kb/page.tsx`
- Modify: `app/[locale]/(app)/files/page.tsx`
- Modify: `app/[locale]/(app)/dealers/register/page.tsx` (already admin-gated client-side; leave as-is — see note)

- [ ] **Step 1: Confirm each target page is a server component**

All nine pages start with `export default async function` (no `'use client'` directive) — verified by checking the first line of each file:

```bash
for f in listings editown mobilebg tasks expenses templates mapping kb files; do
  head -1 "app/[locale]/(app)/$f/page.tsx"
done
```
Expected: none of the nine print `'use client'`. (If any of them surprisingly do, stop and re-plan that file's guard as a wrapper — but this should not occur based on the codebase survey done while writing this plan.)

- [ ] **Step 2: Add the guard to each page**

For each of the nine pages, add near the top of the async function body, before any data fetching, the import:

```ts
import { requirePagePermission } from '@/lib/api/auth-helpers';
import { redirect } from 'next/navigation';
```
(add `redirect` only if the file doesn't already import it — `translations/page.tsx` shows the existing pattern)

and the guard, using the `PageKey` that matches the file:

```ts
const pageAccess = await requirePagePermission('listings');
if ('redirect' in pageAccess) redirect(pageAccess.redirect);
```

The `PageKey` literal to use per file:

| File | `PageKey` |
|---|---|
| `listings/page.tsx` | `'listings'` |
| `editown/page.tsx` | `'editown'` |
| `mobilebg/page.tsx` | `'mobilebg'` |
| `tasks/page.tsx` | `'tasks'` |
| `expenses/page.tsx` | `'expenses'` |
| `templates/page.tsx` | `'templates'` |
| `mapping/page.tsx` | `'mapping'` |
| `kb/page.tsx` | `'kb'` |
| `files/page.tsx` | `'files'` |

- [ ] **Step 3: Leave `dealers/register` as-is**

`app/[locale]/(app)/dealers/register/page.tsx` already gates on `role !== 'admin'` client-side, and `dealers` access is intentionally tied to the `config`/`dealers` admin area — no change needed here; it's covered by the existing admin check.

- [ ] **Step 4: Verify each gate manually**

With the dev server running and logged in as the restricted `browsertestdealer` user (sees only `dashboard` + `editown`):
- Visit `http://localhost:3000/en/listings` directly.
  Expected: redirected to `/dashboard` (or `/en/dashboard`).
- Visit `http://localhost:3000/en/editown` directly.
  Expected: page loads normally.

Then log back in as an admin and confirm every page in the list still loads normally (no false-positive redirects).

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/listings/page.tsx" "app/[locale]/(app)/editown/page.tsx" \
        "app/[locale]/(app)/mobilebg/page.tsx" "app/[locale]/(app)/tasks/page.tsx" \
        "app/[locale]/(app)/expenses/page.tsx" "app/[locale]/(app)/templates/page.tsx" \
        "app/[locale]/(app)/mapping/page.tsx" "app/[locale]/(app)/kb/page.tsx" \
        "app/[locale]/(app)/files/page.tsx"
git commit -m "feat: enforce page permissions on gated admin pages"
```

---

### Task 10: Gate the primary API routes behind each restricted page

**Files:**
- Modify: `app/api/listings/route.ts`
- Modify: `app/api/tasks/route.ts`
- Modify: `app/api/expenses/route.ts` (or its actual primary listing route — confirm exact path while reading)
- Modify: API routes backing `/editown`, `/mobilebg`, `/templates`, `/mapping`, `/kb`, `/files` primary data fetches (confirm exact file paths during Step 1)

- [ ] **Step 1: Locate the primary data route for each gated section**

Run:
```bash
find app/api -maxdepth 1 -type d | sort
```
For each of `listings`, `editown` (look under `app/api/editown` or wherever its data is served from — the page may fetch server-side via `lib/queries.ts` instead of a client API route, in which case **no API gate is needed for that section** since the page guard from Task 9 already covers it), `mobilebg`, `tasks`, `expenses`, `templates`, `mapping`, `kb`, `files`, identify the route file(s) that serve the section's primary listing/data `GET` endpoint and currently call `requireAuth()` (the existing pattern, e.g. `app/api/users/route.ts`).

Only routes that are reachable independently of the gated page (i.e. called client-side via `fetch`/`apiRequest` from a browser) need the new guard — routes only ever called from server components during page render are already protected transitively by the Task 9 page guard.

- [ ] **Step 2: Swap `requireAuth` for `requireApiPagePermission` where appropriate**

For each identified route, change:
```ts
const check = await requireAuth();
if ('error' in check) return check.error;
```
to:
```ts
const check = await requireApiPagePermission('listings'); // matching PageKey per route
if ('error' in check) return check.error;
```
adding the import `import { requireApiPagePermission } from '@/lib/api/auth-helpers';` (replacing or alongside the existing `requireAuth` import — remove `requireAuth` from the import if it becomes unused in that file).

Do **not** touch routes that are shared across multiple sections (e.g. a generic `/api/dealers` lookup used by both gated and ungated pages) — only gate routes whose entire purpose is to serve one specific gated section's primary data.

- [ ] **Step 3: Verify with `curl` as the restricted user**

Get the restricted user's session cookie by logging in as `browsertestdealer` in the browser, then copying the `authjs.session-token` (or `__Secure-authjs.session-token`) cookie value from devtools, and run:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/listings \
  -H 'Cookie: authjs.session-token=<paste-cookie-value>'
```

Expected: `403` for routes backing pages the restricted user cannot see, and `200` for `editown`'s route(s).

Then repeat with an admin session cookie — expect `200` everywhere.

- [ ] **Step 4: Commit**

```bash
git add app/api  # stage only the specific files you modified; avoid a blanket add if other unrelated changes exist
git commit -m "feat: enforce page permissions on gated API routes"
```

---

### Task 11: Admin UI to grant/revoke page permissions per user

**Files:**
- Create: `app/api/users/[id]/permissions/route.ts`
- Create: `app/[locale]/(app)/dealers/[id]/users/[userId]/permissions/page.tsx`
- Create: `app/[locale]/(app)/dealers/[id]/users/[userId]/permissions/PermissionsForm.tsx`
- Modify: `app/[locale]/(app)/dealers/[id]/credentials/page.tsx` (add a link to the permissions screen for the dealer's user — confirm where the dealer's associated `user_id` is available on this page during Step 1)

- [ ] **Step 1: Add query helpers**

In `lib/query-modules/core.ts`, alongside the existing `getAllUsers` (around line 149), add:

```ts
export interface UserPermissionsRow {
  id: number;
  username: string;
  name: string;
  role: string;
  email: string | null;
  dealerId: number | null;
  grantedPageKeys: string[];
}

export function getUserWithPermissions(userId: number): UserPermissionsRow | null {
  const user = raw
    .prepare('SELECT id, username, name, role, email, dealer_id AS dealerId FROM users WHERE id = ?')
    .get(userId) as { id: number; username: string; name: string; role: string; email: string | null; dealerId: number | null } | undefined;
  if (!user) return null;

  const rows = raw
    .prepare('SELECT page_key FROM user_page_permissions WHERE user_id = ?')
    .all(userId) as { page_key: string }[];

  return { ...user, grantedPageKeys: rows.map((r) => r.page_key) };
}

export function setUserPagePermissions(userId: number, pageKeys: string[]): void {
  const now = new Date().toISOString();
  const replace = raw.transaction(() => {
    raw.prepare('DELETE FROM user_page_permissions WHERE user_id = ?').run(userId);
    const insert = raw.prepare(
      'INSERT INTO user_page_permissions (user_id, page_key, created_at) VALUES (?, ?, ?)',
    );
    for (const key of pageKeys) insert.run(userId, key, now);
  });
  replace();
}
```

(Check the top of `lib/query-modules/core.ts` for the existing `raw` import — reuse it; do not add a duplicate import.)

- [ ] **Step 2: Write the API route**

Create `app/api/users/[id]/permissions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-helpers';
import { getUserWithPermissions, setUserPagePermissions } from '@/lib/queries';
import { isPageKey, PAGE_KEYS } from '@/lib/page-permissions';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: 'invalid user id' }, { status: 400 });
  }

  const user = getUserWithPermissions(userId);
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({ ...user, allPageKeys: PAGE_KEYS });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: 'invalid user id' }, { status: 400 });
  }

  const body = await req.json() as { pageKeys?: unknown };
  const incoming = Array.isArray(body.pageKeys) ? body.pageKeys : [];
  const pageKeys = incoming.filter((key): key is string => typeof key === 'string' && isPageKey(key));

  setUserPagePermissions(userId, pageKeys);
  return NextResponse.json({ ok: true, pageKeys });
}
```

Re-export `getUserWithPermissions` and `setUserPagePermissions` from `lib/queries.ts` if that file re-exports `lib/query-modules/core.ts` members individually (check how `getAllUsers` is currently re-exported and follow the same pattern).

- [ ] **Step 3: Write the permissions form (client component)**

Create `app/[locale]/(app)/dealers/[id]/users/[userId]/permissions/PermissionsForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiRequest, errorMessage } from '@/lib/utils';
import { PAGE_KEYS, type PageKey } from '@/lib/page-permissions';

const PAGE_LABELS: Record<PageKey, string> = {
  listings: 'Listings',
  editown: 'Edit Own',
  mobilebg: 'Mobile.bg',
  tasks: 'Tasks',
  expenses: 'Expenses',
  templates: 'Templates',
  translations: 'Translations',
  config: 'Config',
  mapping: 'Mapping',
  kb: 'Knowledge Base',
  files: 'Files',
  dealers: 'Dealers',
};

export function PermissionsForm({
  userId,
  username,
  initialGrantedPageKeys,
}: {
  userId: number;
  username: string;
  initialGrantedPageKeys: string[];
}) {
  const router = useRouter();
  const [granted, setGranted] = useState<Set<string>>(new Set(initialGrantedPageKeys));
  const [saving, setSaving] = useState(false);

  function toggle(key: PageKey) {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiRequest(`/api/users/${userId}/permissions`, 'Failed to save permissions', {
        method: 'PUT',
        json: { pageKeys: Array.from(granted) },
      });
      toast.success(`Permissions updated for ${username}`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save permissions'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-300 opacity-60">
        <input type="checkbox" checked readOnly className="rounded border-gray-600" />
        Dashboard <span className="text-xs text-gray-500">(always visible)</span>
      </div>

      {PAGE_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-gray-600"
            checked={granted.has(key)}
            onChange={() => toggle(key)}
          />
          {PAGE_LABELS[key]}
        </label>
      ))}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded px-4 py-2 transition-colors"
      >
        {saving ? 'Saving…' : 'Save permissions'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Write the page (server component)**

Create `app/[locale]/(app)/dealers/[id]/users/[userId]/permissions/page.tsx`:

```tsx
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserWithPermissions } from '@/lib/queries';
import { PermissionsForm } from './PermissionsForm';

export default async function UserPermissionsPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    redirect('/dashboard');
  }

  const { userId: userIdParam } = await params;
  const userId = parseInt(userIdParam, 10);
  if (Number.isNaN(userId)) notFound();

  const user = getUserWithPermissions(userId);
  if (!user) notFound();

  return (
    <div className="min-h-screen bg-[#111827] p-8">
      <h1 className="text-xl font-semibold text-gray-100 mb-1">Page permissions</h1>
      <p className="text-sm text-gray-400 mb-6">
        Choose which admin pages <span className="font-mono">{user.username}</span> can see.
      </p>
      <PermissionsForm
        userId={user.id}
        username={user.username}
        initialGrantedPageKeys={user.grantedPageKeys}
      />
    </div>
  );
}
```

- [ ] **Step 5: Link to the permissions screen from the dealer credentials page**

Read `app/[locale]/(app)/dealers/[id]/credentials/page.tsx` in full to find where the dealer's associated user id is available (it likely needs a small data fetch — e.g. `SELECT id, username FROM users WHERE dealer_id = ?` — check if such a query already exists in `lib/queries.ts`/`lib/query-modules/core.ts`, or add one named `getUserByDealerId(dealerId): { id: number; username: string } | null` next to `getUserWithPermissions` in Task 11 Step 1's edits to `core.ts`). Add a link near the top of the page, e.g.:

```tsx
{dealerUser && (
  <Link
    href={`/dealers/${dealerId}/users/${dealerUser.id}/permissions`}
    className="text-sm text-blue-400 hover:text-blue-300 underline"
  >
    Manage page permissions for {dealerUser.username}
  </Link>
)}
```

placed in whatever header/info section already exists on that page (follow the surrounding layout conventions you observe when reading the file).

- [ ] **Step 6: Verify end to end**

With the dev server running and logged in as admin:
1. Navigate to `/dealers/<id>/credentials` for the dealer created by `browsertestdealer`'s registration, click through to its permissions page.
2. Confirm the checkboxes reflect the seeded default (`Edit Own` checked, everything else unchecked, `Dashboard` shown as always-on).
3. Check `Listings`, click "Save permissions". Confirm the success toast appears.
4. Verify the database:
   ```bash
   sqlite3 /Users/v/dev/scraped/listings.db "SELECT page_key FROM user_page_permissions WHERE user_id = <browsertestdealer's id> ORDER BY page_key;"
   ```
   Expected: `editown` and `listings`.
5. In a private window, log in as `browsertestdealer` and confirm `Listings` now appears in the sidebar and the page loads (no redirect).

- [ ] **Step 7: Commit**

```bash
git add app/api/users lib/query-modules/core.ts lib/queries.ts \
        "app/[locale]/(app)/dealers/[id]/users" \
        "app/[locale]/(app)/dealers/[id]/credentials/page.tsx"
git commit -m "feat: add admin UI for managing per-user page permissions"
```

---

### Task 12: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full lint and build**

Run:
```bash
npm run lint
npm run build
```
Expected: both succeed with no new errors or warnings attributable to this feature's files.

- [ ] **Step 2: Regression-check an existing trusted non-admin user**

Pick a pre-existing non-admin user (one that existed before Task 1's migration ran) and log in as them.
Expected: their sidebar looks exactly as it did before this feature shipped — every page they could see before, they can still see (the backfill in Task 1 granted them all 12 keys).

- [ ] **Step 3: Walk the full new-dealer journey once more, end to end**

In a clean private window:
1. Visit `/login`, click "Register as a dealer".
2. Fill in the form with a brand-new slug/username/email and submit.
3. Confirm landing on `/dashboard`, signed in, sidebar showing only Dashboard + Edit Own.
4. As admin, grant them `Tasks` via the new permissions screen.
5. Refresh the dealer's session (log out/in) and confirm `Tasks` now appears and is reachable, while everything else still redirects/403s as expected.

- [ ] **Step 4: Commit (if any fixes were needed during verification)**

```bash
git add -A
git commit -m "fix: address issues found during final verification pass"
```
(Skip this step entirely if no fixes were needed.)
