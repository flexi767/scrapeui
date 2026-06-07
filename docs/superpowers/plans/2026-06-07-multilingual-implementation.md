# Multilingual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform scrapeui into a multilingual application (Bulgarian, English, German, Russian) with URL-based routing, database-backed translations, and admin management UI.

**Architecture:** Use next-intl for routing and localization features. Database-backed translation storage allows editors to manage content via admin UI. Middleware detects locale from URL and sets cookie for persistence. Components use `t()` hooks to retrieve translations.

**Tech Stack:** next-intl, SQLite (Drizzle ORM), Next.js App Router, React 19

---

## File Structure

### New Files (Phase 1-2)
```
i18n/
  routing.ts              # Locale configuration
  request.ts              # Server-side translation loader
  db.ts                   # Database functions for translations
middleware.ts             # Locale detection & validation
db/schema.ts              # Add translation tables (locales, translation_keys, translations)
scripts/
  migrate-add-locales.sql # SQL migration for translation schema
  extract-translations.ts # Script to extract hardcoded strings
  seed-translations.ts    # Script to seed initial translations
components/
  LanguageSelector.tsx    # Language switcher dropdown
lib/
  translation-utils.ts    # Helper functions (setCookie, etc.)
app/
  [locale]/
    layout.tsx            # Root layout with locale context (updated)
    (app)/
      translations/
        page.tsx          # Admin UI for managing translations
```

### Modified Files
```
package.json              # Add next-intl dependency
next.config.ts            # Install next-intl plugin
app/layout.tsx            # Restructure for locale routing
components/Dashboard.tsx  # Replace hardcoded strings (Phase 3)
components/AppSidebar.tsx # Replace hardcoded strings (Phase 3)
[All other UI components] # Replace hardcoded strings (Phase 3)
```

---

## Phase 1: Installation & Configuration

### Task 1: Install next-intl and Create i18n Directory

**Files:**
- Modify: `package.json`
- Create: `i18n/routing.ts`
- Create: `i18n/request.ts`
- Create: `i18n/db.ts`

- [ ] **Step 1: Install next-intl package**

Run: `npm install next-intl`

Expected: Package added to `package.json` and `node_modules/`

- [ ] **Step 2: Create i18n/routing.ts**

Create file at `/Users/v/dev/scrapeui/i18n/routing.ts`:

```typescript
export const locales = ['bg', 'en', 'de', 'ru'] as const;
export const defaultLocale = 'bg' as const;
export type Locale = (typeof locales)[number];
```

- [ ] **Step 3: Create i18n/request.ts**

Create file at `/Users/v/dev/scrapeui/i18n/request.ts`:

```typescript
import { getRequestConfig } from 'next-intl/server';
import { getTranslationsFromDb } from './db';

export default getRequestConfig(async ({ locale }) => {
  const messages = await getTranslationsFromDb(locale);
  return { messages };
});
```

- [ ] **Step 4: Create i18n/db.ts (stub for now)**

Create file at `/Users/v/dev/scrapeui/i18n/db.ts`:

```typescript
// Database translation loader
// Will be implemented in Task 3 after schema is created

export async function getTranslationsFromDb(locale: string) {
  // Stub: return empty object for now
  // Phase 1 setup allows next-intl to initialize without DB
  return {};
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json i18n/routing.ts i18n/request.ts i18n/db.ts
git commit -m "feat: install next-intl and create i18n configuration"
```

---

### Task 2: Create Database Schema for Translations

**Files:**
- Modify: `db/schema.ts`
- Create: `scripts/migrate-add-locales.sql`

- [ ] **Step 1: Add translation tables to db/schema.ts**

Open `/Users/v/dev/scrapeui/db/schema.ts` and add at the end:

```typescript
import { sql } from 'drizzle-orm';

export const locales = sqliteTable('locales', {
  code: text('code').primaryKey(), // 'bg', 'en', 'de', 'ru'
  name: text('name').notNull(), // 'Bulgarian', 'English', etc.
  is_active: integer('is_active').default(1), // 1 = enabled, 0 = disabled
});

export const translationKeys = sqliteTable('translation_keys', {
  id: text('id').primaryKey(), // 'nav.listings', 'error.not_found', etc.
  context: text('context'), // 'ui', 'content', 'error', 'form'
  description: text('description'), // Help text for translators
  plural_rules: integer('plural_rules').default(0), // 1 if has plural variants
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const translations = sqliteTable(
  'translations',
  {
    id: text('id').primaryKey(), // UUID
    translation_key_id: text('translation_key_id')
      .notNull()
      .references(() => translationKeys.id, { onDelete: 'cascade' }),
    locale_code: text('locale_code')
      .notNull()
      .references(() => locales.code, { onDelete: 'cascade' }),
    value: text('value').notNull(), // The translated string
    plural_form: text('plural_form'), // 'zero', 'one', 'few', 'many', 'other', or null
    interpolation_vars: text('interpolation_vars'), // JSON metadata
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    unique_key_locale_form: unique().on(
      table.translation_key_id,
      table.locale_code,
      table.plural_form,
    ),
  }),
);
```

- [ ] **Step 2: Create SQL migration script**

Create file at `/Users/v/dev/scrapeui/scripts/migrate-add-locales.sql`:

```sql
-- Create locales table
CREATE TABLE IF NOT EXISTS locales (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- Create translation_keys table
CREATE TABLE IF NOT EXISTS translation_keys (
  id TEXT PRIMARY KEY,
  context TEXT,
  description TEXT,
  plural_rules INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create translations table
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  translation_key_id TEXT NOT NULL,
  locale_code TEXT NOT NULL,
  value TEXT NOT NULL,
  plural_form TEXT,
  interpolation_vars TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(translation_key_id, locale_code, plural_form),
  FOREIGN KEY (translation_key_id) REFERENCES translation_keys(id) ON DELETE CASCADE,
  FOREIGN KEY (locale_code) REFERENCES locales(code) ON DELETE CASCADE
);

-- Seed supported locales
INSERT OR IGNORE INTO locales (code, name, is_active) VALUES
  ('bg', 'Български', 1),
  ('en', 'English', 1),
  ('de', 'Deutsch', 1),
  ('ru', 'Русский', 1);
```

- [ ] **Step 3: Apply migration**

Run: `sqlite3 /Users/v/dev/scraped/listings.db < scripts/migrate-add-locales.sql`

Expected: Tables created, locales seeded (no errors)

- [ ] **Step 4: Verify schema**

Run: `sqlite3 /Users/v/dev/scraped/listings.db ".schema locales"`

Expected: Shows locales table definition

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts scripts/migrate-add-locales.sql
git commit -m "feat: add translation schema to database"
```

---

### Task 3: Implement i18n/db.ts to Load Translations from Database

**Files:**
- Modify: `i18n/db.ts`
- Modify: `lib/queries.ts` (or create `lib/translation-queries.ts`)

- [ ] **Step 1: Write translation query function**

Open or create `/Users/v/dev/scrapeui/lib/translation-queries.ts`:

```typescript
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { translations, translationKeys, locales } from '@/db/schema';

export function getTranslationsForLocale(locale: string) {
  const rows = db
    .select({
      id: translationKeys.id,
      value: translations.value,
      plural_form: translations.plural_form,
    })
    .from(translations)
    .innerJoin(
      translationKeys,
      eq(translations.translation_key_id, translationKeys.id),
    )
    .where(
      and(
        eq(translations.locale_code, locale),
        eq(locales.is_active, 1),
      ),
    )
    .all();

  return rows;
}
```

- [ ] **Step 2: Implement i18n/db.ts**

Update `/Users/v/dev/scrapeui/i18n/db.ts`:

```typescript
import { getTranslationsForLocale } from '@/lib/translation-queries';

export async function getTranslationsFromDb(locale: string) {
  const messages: Record<string, any> = {};

  try {
    const rows = getTranslationsForLocale(locale);

    // Build nested structure: 'nav.listings' → { nav: { listings: '...' } }
    rows.forEach((row) => {
      const keys = row.id.split('.');
      let current = messages;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      const lastKey = keys[keys.length - 1];
      
      // Handle plural forms
      if (row.plural_form) {
        if (!current[lastKey]) {
          current[lastKey] = {};
        }
        current[lastKey][row.plural_form] = row.value;
      } else {
        current[lastKey] = row.value;
      }
    });

    return messages;
  } catch (error) {
    console.error(`Failed to load translations for locale ${locale}:`, error);
    // Return empty object; next-intl will fall back to Bulgarian
    return {};
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/translation-queries.ts i18n/db.ts
git commit -m "feat: implement database translation loader"
```

---

### Task 4: Update next.config.ts with next-intl Plugin

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Update next.config.ts**

Open `/Users/v/dev/scrapeui/next.config.ts` and replace entire content:

```typescript
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const config: NextConfig = {
  experimental: {
    // Keep existing experimental settings if any
  },
};

export default withNextIntl(config);
```

- [ ] **Step 2: Verify build doesn't error**

Run: `npm run build 2>&1 | head -30`

Expected: Build starts without errors (may take a moment)

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: integrate next-intl plugin into Next.js config"
```

---

### Task 5: Create and Configure Middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware.ts**

Create file at `/Users/v/dev/scrapeui/middleware.ts`:

```typescript
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/routing';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always', // Always include /bg, /en, etc. in URL
});

export const config = {
  // Apply middleware to all routes except API, assets, etc.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add next-intl middleware for locale detection"
```

---

### Task 6: Create Helper Utility for Cookie Management

**Files:**
- Create: `lib/translation-utils.ts`

- [ ] **Step 1: Create translation-utils.ts**

Create file at `/Users/v/dev/scrapeui/lib/translation-utils.ts`:

```typescript
export function setCookie(
  name: string,
  value: string,
  days: number = 365,
): void {
  if (typeof document === 'undefined') return; // Skip on server

  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
}

export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined; // Skip on server

  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(nameEQ)) {
      return trimmed.substring(nameEQ.length);
    }
  }
  return undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/translation-utils.ts
git commit -m "feat: add cookie utilities for language persistence"
```

---

## Phase 2: Restructure App for Locale Routing

### Task 7: Restructure App Layout for [locale] Routing

**Files:**
- Create: `app/[locale]/layout.tsx`
- Create: `app/[locale]/page.tsx`
- Create: `app/[locale]/login/page.tsx`
- Modify: `app/layout.tsx` (remove from root, keep only global setup)
- Move: `app/(app)/*` → `app/[locale]/(app)/*`

- [ ] **Step 1: Create new root layout.tsx**

This is the outermost layout (no locale). Create `/Users/v/dev/scrapeui/app/layout.tsx` (overwrite existing):

```typescript
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dealer Listings Tracker',
  description: 'Track dealer car listings',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className="min-h-screen bg-[#111827] text-gray-100 antialiased">
        {children}
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create [locale] layout.tsx**

Create `/Users/v/dev/scrapeui/app/[locale]/layout.tsx`:

```typescript
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateStaticParams() {
  return [{ locale: 'bg' }, { locale: 'en' }, { locale: 'de' }, { locale: 'ru' }];
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-[#111827] text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Move existing pages under [locale]**

Run:
```bash
# Create new directory structure
mkdir -p app/[locale]/(app)

# Move existing protected routes
mv app/\(app\)/* app/[locale]/\(app\)/

# Move login page (it's currently under app/login)
mkdir -p app/[locale]/login
# Note: update the login page routing path if it exists

# Remove old directories
rmdir app/\(app\) 2>/dev/null || true
```

- [ ] **Step 4: Create homepage at [locale]/page.tsx**

If there's no root homepage, create `/Users/v/dev/scrapeui/app/[locale]/page.tsx`:

```typescript
import { useTranslations } from 'next-intl';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth();
  
  // Redirect to dashboard if authenticated
  if (session) {
    redirect('/dashboard');
  }
  
  // Redirect to login if not authenticated
  redirect('/login');
}
```

- [ ] **Step 5: Verify app structure**

Run: `find app/[locale] -type f -name "*.tsx" | head -10`

Expected: Files are now under `app/[locale]/` and `app/[locale]/(app)/`

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/[locale]/layout.tsx app/[locale]/page.tsx
git commit -m "refactor: restructure app for locale-based routing"
```

---

### Task 8: Create Language Selector Component

**Files:**
- Create: `components/LanguageSelector.tsx`

- [ ] **Step 1: Create LanguageSelector.tsx**

Create `/Users/v/dev/scrapeui/components/LanguageSelector.tsx`:

```typescript
'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next-intl/navigation';
import { setCookie } from '@/lib/translation-utils';

const LOCALES = ['bg', 'en', 'de', 'ru'] as const;
const LOCALE_NAMES: Record<(typeof LOCALES)[number], string> = {
  bg: 'Български',
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
};

export function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();

  const handleChange = (newLocale: string) => {
    // Set cookie for persistence
    setCookie('NEXT_LOCALE', newLocale, 365);
    
    // Navigate to the same path in the new locale
    // next-intl/navigation router handles locale prefix automatically
    router.push(window.location.pathname.slice(`/${locale}`.length), { locale: newLocale as any });
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="px-2 py-1 bg-gray-800 text-gray-100 border border-gray-600 rounded cursor-pointer"
    >
      {LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {LOCALE_NAMES[loc]}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Add LanguageSelector to app header/navigation**

Open `/Users/v/dev/scrapeui/components/AppSidebar.tsx` (or main navigation component) and add the import and usage:

```typescript
import { LanguageSelector } from './LanguageSelector';

// In the component's JSX, add the LanguageSelector to the header/footer area
// Example placement in sidebar footer or top navigation:
<div className="flex items-center gap-2">
  <LanguageSelector />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add components/LanguageSelector.tsx components/AppSidebar.tsx
git commit -m "feat: add language selector component"
```

---

## Phase 2: Extract and Seed Initial Translations

### Task 9: Create String Extraction Script

**Files:**
- Create: `scripts/extract-translations.ts`

- [ ] **Step 1: Create extract-translations.ts**

Create `/Users/v/dev/scrapeui/scripts/extract-translations.ts`:

```typescript
import fs from 'fs';
import path from 'path';

interface ExtractedString {
  key: string;
  value: string;
  context: 'ui' | 'content' | 'error';
  file: string;
  line: number;
}

const extracted = new Map<string, ExtractedString>();

// Scan components directory for hardcoded strings
function scanDirectory(dir: string) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !file.startsWith('.')) {
      scanDirectory(fullPath);
      continue;
    }

    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Pattern 1: label: 'String'
      const labelMatch = line.match(/label:\s*['"`]([^'"`]+)['"`]/g);
      if (labelMatch) {
        labelMatch.forEach((match) => {
          const value = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
          if (value) {
            const key = `ui.${value.toLowerCase().replace(/\s+/g, '_')}`;
            extracted.set(key, {
              key,
              value,
              context: 'ui',
              file: fullPath,
              line: index + 1,
            });
          }
        });
      }

      // Pattern 2: description: 'String'
      const descMatch = line.match(/description:\s*['"`]([^'"`]+)['"`]/g);
      if (descMatch) {
        descMatch.forEach((match) => {
          const value = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
          if (value) {
            const key = `ui.${value.toLowerCase().replace(/\s+/g, '_')}`;
            extracted.set(key, {
              key,
              value,
              context: 'ui',
              file: fullPath,
              line: index + 1,
            });
          }
        });
      }

      // Pattern 3: Plain text in JSX (simple heuristic)
      const jsxMatch = line.match(/<[^>]*>([A-Z][^<]*)<\/[^>]*>/);
      if (jsxMatch && jsxMatch[1].trim().length > 3) {
        const value = jsxMatch[1].trim();
        const key = `ui.${value.toLowerCase().replace(/\s+/g, '_').substring(0, 30)}`;
        extracted.set(key, {
          key,
          value,
          context: 'ui',
          file: fullPath,
          line: index + 1,
        });
      }
    });
  }
}

// Run extraction
const componentsDir = path.join(process.cwd(), 'components');
scanDirectory(componentsDir);

// Output results
console.log(`\n📋 Extracted ${extracted.size} translation keys:\n`);

const results: ExtractedString[] = Array.from(extracted.values());
results.sort((a, b) => a.key.localeCompare(b.key));

results.forEach((result) => {
  console.log(`${result.key}`);
  console.log(`  Value: "${result.value}"`);
  console.log(`  File: ${result.file}:${result.line}\n`);
});

// Save to JSON for import
const outputPath = path.join(process.cwd(), 'scripts', 'extracted-keys.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n✅ Saved to ${outputPath}`);
```

- [ ] **Step 2: Run extraction script**

Run: `cd /Users/v/dev/scrapeui && npx tsx scripts/extract-translations.ts | head -30`

Expected: Shows extracted keys (e.g., `ui.listings`, `ui.edit_own`, etc.)

- [ ] **Step 3: Review extracted-keys.json**

Run: `head -20 scripts/extracted-keys.json`

Expected: JSON array with extracted strings and metadata

- [ ] **Step 4: Commit**

```bash
git add scripts/extract-translations.ts scripts/extracted-keys.json
git commit -m "feat: add translation extraction script"
```

---

### Task 10: Create Translation Seeding Script

**Files:**
- Create: `scripts/seed-translations.ts`

- [ ] **Step 1: Create seed-translations.ts**

Create `/Users/v/dev/scrapeui/scripts/seed-translations.ts`:

```typescript
import { db } from '@/db/client';
import { locales, translationKeys, translations } from '@/db/schema';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';

interface ExtractedKey {
  key: string;
  value: string;
  context: string;
  file: string;
  line: number;
}

async function seedTranslations() {
  console.log('🌱 Seeding translations...\n');

  // Read extracted keys
  const extractedPath = path.join(process.cwd(), 'scripts', 'extracted-keys.json');
  const extracted: ExtractedKey[] = JSON.parse(fs.readFileSync(extractedPath, 'utf-8'));

  console.log(`📝 Processing ${extracted.length} keys...\n`);

  for (const key of extracted) {
    // Create translation_key entry
    try {
      db.insert(translationKeys).values({
        id: key.key,
        context: key.context,
        description: `Extracted from ${path.basename(key.file)}:${key.line}`,
        plural_rules: 0,
      }).run();
    } catch (error: any) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`Error creating key ${key.key}:`, error);
      }
    }

    // Create Bulgarian translation (use extracted English value as fallback)
    try {
      db.insert(translations).values({
        id: nanoid(),
        translation_key_id: key.key,
        locale_code: 'bg',
        value: key.value, // Use English as Bulgarian for now (will be refined later)
        plural_form: null,
      }).run();
    } catch (error: any) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`Error creating BG translation for ${key.key}:`, error);
      }
    }

    // Create English translation
    try {
      db.insert(translations).values({
        id: nanoid(),
        translation_key_id: key.key,
        locale_code: 'en',
        value: key.value,
        plural_form: null,
      }).run();
    } catch (error: any) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`Error creating EN translation for ${key.key}:`, error);
      }
    }

    // Create German placeholder (same as English for now)
    try {
      db.insert(translations).values({
        id: nanoid(),
        translation_key_id: key.key,
        locale_code: 'de',
        value: key.value,
        plural_form: null,
      }).run();
    } catch (error: any) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`Error creating DE translation for ${key.key}:`, error);
      }
    }

    // Create Russian placeholder (same as English for now)
    try {
      db.insert(translations).values({
        id: nanoid(),
        translation_key_id: key.key,
        locale_code: 'ru',
        value: key.value,
        plural_form: null,
      }).run();
    } catch (error: any) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`Error creating RU translation for ${key.key}:`, error);
      }
    }
  }

  console.log('✅ Seeding complete!\n');

  // Show summary
  const keyCount = db.select().from(translationKeys).all().length;
  const transCount = db.select().from(translations).all().length;
  console.log(`📊 Summary:`);
  console.log(`   Translation keys: ${keyCount}`);
  console.log(`   Translations: ${transCount}`);
}

seedTranslations().catch(console.error);
```

- [ ] **Step 2: Run seeding script**

Run: `cd /Users/v/dev/scrapeui && npx tsx scripts/seed-translations.ts`

Expected: "Seeding complete!" with counts of inserted keys

- [ ] **Step 3: Verify data in database**

Run: `sqlite3 /Users/v/dev/scraped/listings.db "SELECT COUNT(*) FROM translation_keys; SELECT COUNT(*) FROM translations;"`

Expected: Shows counts (e.g., 15 keys, 60 translations for 4 locales)

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-translations.ts
git commit -m "feat: add translation seeding script"
```

---

## Phase 3: Update Components to Use Translations

### Task 11: Update Dashboard Component to Use Translations

**Files:**
- Modify: `components/Dashboard.tsx`

- [ ] **Step 1: Add translation imports and usage**

Open `/Users/v/dev/scrapeui/components/Dashboard.tsx` and update:

Replace the `navigationLinks` constant with translation keys:

```typescript
import { useTranslations } from 'next-intl';

export function Dashboard() {
  const { data: session, status: sessionStatus } = useSession();
  const t = useTranslations('nav');
  
  const navigationLinks = [
    { href: '/listings', label: t('listings'), icon: CarFront, description: t('listings_description') },
    { href: '/editown', label: t('edit_own'), icon: EditIcon, description: t('edit_own_description') },
    { href: '/mobilebg', label: t('mobilebg'), icon: ArchiveIcon, description: t('mobilebg_description') },
    { href: '/mapping', label: t('mapping'), icon: MapIcon, description: t('mapping_description') },
    { href: '/tasks', label: t('tasks'), icon: ListTodo, description: t('tasks_description') },
    { href: '/kb', label: t('kb'), icon: BookIcon, description: t('kb_description') },
    { href: '/config', label: t('config'), icon: SettingsIcon, description: t('config_description') },
  ];

  // ... rest of component
}
```

Add UI translation keys to database for Dashboard:

Run:
```sql
INSERT OR IGNORE INTO translation_keys (id, context, description) VALUES
  ('nav.listings', 'ui', 'Navigation: Listings'),
  ('nav.listings_description', 'ui', 'Browse all car listings'),
  ('nav.edit_own', 'ui', 'Navigation: Edit Own'),
  ('nav.edit_own_description', 'ui', 'Manage your listings'),
  ('nav.mobilebg', 'ui', 'Navigation: Mobile.bg'),
  ('nav.mobilebg_description', 'ui', 'Mobile.bg integrations'),
  ('nav.mapping', 'ui', 'Navigation: Mapping'),
  ('nav.mapping_description', 'ui', 'Brand & model mapping'),
  ('nav.tasks', 'ui', 'Navigation: Tasks'),
  ('nav.tasks_description', 'ui', 'Task management'),
  ('nav.kb', 'ui', 'Navigation: Knowledge Base'),
  ('nav.kb_description', 'ui', 'Documentation'),
  ('nav.config', 'ui', 'Navigation: Configuration'),
  ('nav.config_description', 'ui', 'System settings');
```

Insert translations for each locale (Bulgarian, English, German, Russian).

- [ ] **Step 2: Update formatDate function to use intl formatter**

```typescript
'use client';

import { useFormatter } from 'next-intl';

function useFormattedDate() {
  const format = useFormatter();

  return (dateString: string | null): string => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return format.dateTime(date, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: update Dashboard to use translations"
```

---

### Task 12: Update AppSidebar Component

**Files:**
- Modify: `components/AppSidebar.tsx`

- [ ] **Step 1: Add translations to sidebar navigation**

Open `/Users/v/dev/scrapeui/components/AppSidebar.tsx` and update to use `useTranslations()`:

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { LanguageSelector } from './LanguageSelector';

export function AppSidebar() {
  const t = useTranslations('nav');
  
  const navItems = [
    { href: '/listings', label: t('listings'), icon: CarIcon },
    { href: '/editown', label: t('edit_own'), icon: EditIcon },
    // ... other nav items
  ];

  return (
    <aside>
      {/* Navigation items */}
      {navItems.map(item => (
        <a key={item.href} href={item.href}>{item.label}</a>
      ))}
      
      {/* Add language selector to footer */}
      <div className="mt-auto border-t border-gray-700 pt-4">
        <LanguageSelector />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/AppSidebar.tsx
git commit -m "feat: update AppSidebar with translations and language selector"
```

---

### Task 13: Create Admin UI for Translation Management

**Files:**
- Create: `app/[locale]/(app)/translations/page.tsx`
- Create: `app/[locale]/(app)/translations/TranslationEditor.tsx`

- [ ] **Step 1: Create translations admin page**

Create `/Users/v/dev/scrapeui/app/[locale]/(app)/translations/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TranslationEditor } from './TranslationEditor';

export default async function TranslationsPage() {
  const session = await auth();

  // Only allow admin access
  if (!session || session.user?.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">Manage Translations</h1>
      <TranslationEditor />
    </div>
  );
}
```

- [ ] **Step 2: Create TranslationEditor client component**

Create `/Users/v/dev/scrapeui/app/[locale]/(app)/translations/TranslationEditor.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface TranslationRow {
  key: string;
  context: string;
  description: string;
  bg: string;
  en: string;
  de: string;
  ru: string;
}

export function TranslationEditor() {
  const t = useTranslations('nav');
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    // Fetch all translation keys and their translations
    fetch('/api/translations')
      .then((res) => res.json())
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load translations:', error);
        setLoading(false);
      });
  }, []);

  const handleUpdate = async (key: string, locale: string, value: string) => {
    // Update translation in database via API
    const response = await fetch('/api/translations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, locale, value }),
    });

    if (response.ok) {
      // Update local state
      setRows((prev) =>
        prev.map((row) =>
          row.key === key ? { ...row, [locale]: value } : row,
        ),
      );
    }
  };

  const filteredRows = rows.filter(
    (row) =>
      row.key.includes(filter) ||
      row.context.includes(filter) ||
      row.bg.includes(filter),
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <input
        type="text"
        placeholder="Search by key, context, or value..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 px-4 py-2 bg-gray-800 text-gray-100 border border-gray-600 rounded w-full"
      />

      <table className="w-full border-collapse border border-gray-600">
        <thead>
          <tr className="bg-gray-800">
            <th className="border border-gray-600 px-4 py-2 text-left">Key</th>
            <th className="border border-gray-600 px-4 py-2 text-left">Context</th>
            <th className="border border-gray-600 px-4 py-2 text-left">BG</th>
            <th className="border border-gray-600 px-4 py-2 text-left">EN</th>
            <th className="border border-gray-600 px-4 py-2 text-left">DE</th>
            <th className="border border-gray-600 px-4 py-2 text-left">RU</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr key={row.key} className="hover:bg-gray-800">
              <td className="border border-gray-600 px-4 py-2">{row.key}</td>
              <td className="border border-gray-600 px-4 py-2">{row.context}</td>
              <td className="border border-gray-600 px-4 py-2">
                <input
                  type="text"
                  value={row.bg}
                  onChange={(e) => handleUpdate(row.key, 'bg', e.target.value)}
                  className="w-full bg-gray-700 px-2 py-1 rounded"
                />
              </td>
              <td className="border border-gray-600 px-4 py-2">
                <input
                  type="text"
                  value={row.en}
                  onChange={(e) => handleUpdate(row.key, 'en', e.target.value)}
                  className="w-full bg-gray-700 px-2 py-1 rounded"
                />
              </td>
              <td className="border border-gray-600 px-4 py-2">
                <input
                  type="text"
                  value={row.de}
                  onChange={(e) => handleUpdate(row.key, 'de', e.target.value)}
                  className="w-full bg-gray-700 px-2 py-1 rounded"
                />
              </td>
              <td className="border border-gray-600 px-4 py-2">
                <input
                  type="text"
                  value={row.ru}
                  onChange={(e) => handleUpdate(row.key, 'ru', e.target.value)}
                  className="w-full bg-gray-700 px-2 py-1 rounded"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create API routes for translations management**

Create `/Users/v/dev/scrapeui/app/api/translations/route.ts`:

```typescript
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { translations, translationKeys } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Fetch all translation keys with their translations for all locales
    const keys = db.select().from(translationKeys).all();
    const allTranslations = db.select().from(translations).all();

    const result = keys.map((key) => {
      const transForKey = allTranslations.filter(
        (t) => t.translation_key_id === key.id,
      );

      return {
        key: key.id,
        context: key.context,
        description: key.description,
        bg: transForKey.find((t) => t.locale_code === 'bg')?.value || '',
        en: transForKey.find((t) => t.locale_code === 'en')?.value || '',
        de: transForKey.find((t) => t.locale_code === 'de')?.value || '',
        ru: transForKey.find((t) => t.locale_code === 'ru')?.value || '',
      };
    });

    return Response.json(result);
  } catch (error) {
    console.error('Error fetching translations:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { key, locale, value } = await request.json();

    if (!key || !locale || value === undefined) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Find or create translation
    const existing = db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.translation_key_id, key),
          eq(translations.locale_code, locale),
        ),
      )
      .get();

    if (existing) {
      db.update(translations)
        .set({ value, updated_at: new Date().toISOString() })
        .where(
          and(
            eq(translations.translation_key_id, key),
            eq(translations.locale_code, locale),
          ),
        )
        .run();
    } else {
      db.insert(translations)
        .values({
          id: nanoid(),
          translation_key_id: key,
          locale_code: locale,
          value,
          plural_form: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .run();
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating translation:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/\(app\)/translations/page.tsx app/[locale]/\(app\)/translations/TranslationEditor.tsx app/api/translations/route.ts
git commit -m "feat: add admin UI for translation management"
```

---

## Phase 4: Testing & Verification

### Task 14: Manual Testing Checklist

**Files:**
- None (testing task)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

Expected: Server starts on `http://localhost:3000`

- [ ] **Step 2: Test locale routing**

Navigate to: `http://localhost:3000/bg/listings`

Expected: Page loads with Bulgarian locale detected

Navigate to: `http://localhost:3000/en/listings`

Expected: Page loads with English locale detected

Navigate to: `http://localhost:3000/invalid-locale/listings`

Expected: Redirects to `/bg/listings` (default locale)

- [ ] **Step 3: Test language selector**

Open language selector dropdown → Select English

Expected: URL changes to `/en/...`, page refreshes with English text

Open browser DevTools → Application → Cookies

Expected: `NEXT_LOCALE=en` cookie is set

- [ ] **Step 4: Test cookie persistence**

Manually set cookie in DevTools: `NEXT_LOCALE=de`

Navigate to `/listings` (without locale in URL)

Expected: Redirects to `/de/listings`, German language is displayed

- [ ] **Step 5: Test missing translation fallback**

In database, delete a German translation:

```sql
DELETE FROM translations WHERE locale_code='de' LIMIT 1;
```

Navigate to `/de/listings`

Expected: Missing key falls back to Bulgarian translation

- [ ] **Step 6: Test admin UI**

Navigate to `/translations` (admin page)

Expected: Table displays all translation keys with all 4 language variants

Click on a translation cell and edit it

Expected: Value updates immediately in database (via API)

Navigate to `/en/listings`

Expected: Updated translation appears on page

- [ ] **Step 7: Verify build**

Run: `npm run build`

Expected: Build completes without errors

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: verify locale routing, language selector, and translations"
```

---

## Summary

This plan covers:

✅ **Phase 1:** Install next-intl, create DB schema, configure i18n files, set up middleware  
✅ **Phase 2:** Restructure app for locale routing, create language selector, extract and seed translations  
✅ **Phase 3:** Update Dashboard and AppSidebar components, create admin translation UI  
✅ **Phase 4:** Manual testing and verification  

**Effort estimate:** ~2-3 weeks for MVP (Phases 1-3 complete)

**Next steps after MVP:**
- Translate missing content (DE, RU) with native speakers
- Add more UI components to translations (FilterBar, OwnListingsTable, etc.)
- Implement caching for translations (Redis or in-process)
- Add translation versioning and approval workflow

