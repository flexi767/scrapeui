# Multilingual scrapeui Design

**Date:** 2026-06-07  
**Status:** Approved  
**Scope:** Add Bulgarian (default), English, German, Russian support with database-backed translation management

---

## Executive Summary

Transform scrapeui into a multilingual application using `next-intl` for routing, pluralization, and formatting, backed by a database-driven translation system. This allows editors to manage translations via admin UI without code changes. Users select language via URL (`/bg/listings`, `/en/dashboard`) with cookie-based persistence.

---

## Goals

1. **Support 4 languages:** Bulgarian (default), English, German, Russian
2. **URL-based routing:** All routes prefixed with locale (`/bg/*`, `/en/*`, etc.)
3. **Database-backed translations:** Editors manage content via admin UI, not Git
4. **Full i18n features:** Pluralization, date/number formatting, variable interpolation
5. **Smooth migration:** Extract existing hardcoded strings, replace incrementally
6. **Scalability:** Architecture supports adding languages later without code changes

---

## Architecture

### Locale Selection & Persistence

- **URL-based:** Every route includes locale prefix (`/bg/listings`, `/en/dashboard`)
- **Cookie fallback:** When user navigates to a new locale URL, a `NEXT_LOCALE` cookie is set
- **Middleware detection:** On each request, middleware validates the locale from the URL
- **Supported locales:** `bg` (default), `en`, `de`, `ru`

### Translation Data Flow

```
User visits /de/listings
  ↓
Middleware detects locale='de' from URL
  ↓
Sets NEXT_LOCALE='de' cookie (for future visits)
  ↓
i18n/request.ts loads German translations from DB
  ↓
Components use t('key') → German string returned
  ↓
If translation missing → falls back to Bulgarian
```

### Tech Stack

- **Library:** `next-intl` (purpose-built for Next.js App Router)
- **Routing:** Next.js dynamic segments `app/[locale]/...`
- **Storage:** SQLite tables (`locales`, `translation_keys`, `translations`)
- **Admin UI:** `/[locale]/(app)/translations` (minimal spreadsheet-like interface)
- **Language selector:** Dropdown in app header/footer

---

## Database Schema

### `locales` Table
Defines supported languages and activation status.

```sql
CREATE TABLE locales (
  code TEXT PRIMARY KEY,           -- 'bg', 'en', 'de', 'ru'
  name TEXT NOT NULL,              -- 'Bulgarian', 'English', 'Deutsch', 'Русский'
  is_active INTEGER DEFAULT 1      -- 1=enabled, 0=disabled
);
```

### `translation_keys` Table
UI strings, error messages, and content blocks that need translation.

```sql
CREATE TABLE translation_keys (
  id TEXT PRIMARY KEY,             -- Hierarchical: 'nav.listings', 'error.not_found', 'article.about.title'
  context TEXT,                    -- 'ui' | 'content' | 'error' | 'form' (for organization)
  description TEXT,                -- Help text for translators (e.g., "Button label in dashboard")
  plural_rules BOOLEAN DEFAULT 0   -- 1 if this key has plural variants (e.g., "count.items")
);
```

### `translations` Table
Actual translated strings with metadata.

```sql
CREATE TABLE translations (
  id TEXT PRIMARY KEY,                         -- Auto-generated UUID
  translation_key_id TEXT NOT NULL,            -- FK to translation_keys.id
  locale_code TEXT NOT NULL,                   -- FK to locales.code
  value TEXT NOT NULL,                         -- The translated string
  plural_form TEXT,                            -- 'zero'|'one'|'few'|'many'|'other' (null if non-plural)
  interpolation_vars TEXT,                     -- JSON metadata: {"username": "string", "count": "number"}
  created_at TEXT NOT NULL,                    -- ISO timestamp
  updated_at TEXT NOT NULL,                    -- ISO timestamp
  UNIQUE(translation_key_id, locale_code, plural_form),
  FOREIGN KEY (translation_key_id) REFERENCES translation_keys(id) ON DELETE CASCADE,
  FOREIGN KEY (locale_code) REFERENCES locales(code) ON DELETE CASCADE
);
```

---

## File Structure

```
app/
  [locale]/
    layout.tsx                    # Root layout with locale context
    page.tsx                      # Homepage
    login/
      page.tsx                    # Auth page
    (app)/
      page.tsx                    # Dashboard
      listings/
        page.tsx
      editown/
        page.tsx
      translations/               # Admin UI for managing translations
        page.tsx
      etc.
  api/
    dashboard/route.ts            # API routes (no locale prefix)
    listings/route.ts
    etc.

i18n/
  routing.ts                      # Locale configuration
  request.ts                      # Server-side translation loader
  db.ts                           # Database query functions for translations

middleware.ts                     # Locale detection & routing

components/
  LanguageSelector.tsx            # Dropdown to switch locales
  (existing components updated to use t())
```

---

## Implementation Details

### `i18n/routing.ts`

```typescript
export const locales = ['bg', 'en', 'de', 'ru'] as const;
export const defaultLocale = 'bg' as const;
export type Locale = (typeof locales)[number];
```

### `i18n/request.ts`

Server-side configuration that loads translations from the database.

```typescript
import { getRequestConfig } from 'next-intl/server';
import { getTranslationsFromDb } from './db';

export default getRequestConfig(async ({ locale }) => {
  const messages = await getTranslationsFromDb(locale);
  return { messages };
});
```

### `i18n/db.ts`

Queries the database and builds nested message object.

```typescript
import { db } from '@/db/client';

export async function getTranslationsFromDb(locale: string) {
  const messages: Record<string, any> = {};
  
  const rows = db
    .select({
      id: translationKeys.id,
      value: translations.value,
      pluralForm: translations.plural_form,
    })
    .from(translations)
    .innerJoin(
      translationKeys,
      eq(translations.translation_key_id, translationKeys.id)
    )
    .where(
      and(
        eq(translations.locale_code, locale),
        eq(locales.is_active, 1)
      )
    )
    .all();

  // Build nested structure: 'nav.listings' → { nav: { listings: '...' } }
  rows.forEach(row => {
    const keys = row.id.split('.');
    let current = messages;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = row.value;
  });

  return messages;
}
```

### `middleware.ts`

Detects locale from URL, validates against supported locales, sets cookie.

```typescript
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/routing';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always', // Always include /bg, /en, etc. in URL
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
```

### `next.config.ts`

Integrate next-intl plugin.

```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl({
  // Existing config...
});
```

### Component Usage

**Server component:**
```typescript
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('page.listings');
  return <h1>{t('title')}</h1>;
}
```

**Client component:**
```typescript
'use client';
import { useTranslations } from 'next-intl';

export function ListingCard() {
  const t = useTranslations('listings');
  const count = 5;
  
  // Pluralization example (handled by next-intl based on CLDR rules)
  return <p>{t('count', { count })}</p>;
}
```

**Formatting (dates, numbers):**
```typescript
'use client';
import { useFormatter } from 'next-intl';

export function LastScrapedTime() {
  const format = useFormatter();
  const date = new Date();
  
  return <span>{format.dateTime(date, { year: 'numeric', month: 'long' })}</span>;
}
```

### Language Selector Component

**`components/LanguageSelector.tsx`:**

```typescript
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next-intl/navigation';
import { setCookie } from '@/lib/utils';

export function LanguageSelector() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');

  const locales = ['bg', 'en', 'de', 'ru'];
  const localeNames: Record<string, string> = {
    bg: 'Български',
    en: 'English',
    de: 'Deutsch',
    ru: 'Русский',
  };

  const handleChange = (newLocale: string) => {
    // Set cookie for persistence (365 days)
    setCookie('NEXT_LOCALE', newLocale, 365);
    
    // Navigate to same path in new locale
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <select 
      value={locale} 
      onChange={(e) => handleChange(e.target.value)}
      className="px-2 py-1 bg-gray-800 text-gray-100 border border-gray-600 rounded"
    >
      {locales.map(loc => (
        <option key={loc} value={loc}>{localeNames[loc]}</option>
      ))}
    </select>
  );
}
```

---

## Translation Content Types

### UI Translations
Navigation labels, buttons, form placeholders, error messages, status indicators.

**Key format:** `nav.listings`, `form.submit`, `error.not_found`, `status.pending`

### Content Translations
Articles, descriptions, help text maintained by editors.

**Key format:** `article.about.title`, `article.about.body`, `help.scraping_tips`

### Excluded from Translation
- Scraped listing data (stays as-is from source)
- Brand/model names (pulled from Mobile.bg, not translated)
- User-generated content (stored as-is)

---

## Fallback & Missing Translations

- **Primary fallback:** Bulgarian (`bg` locale)
- **Behavior:** If a translation key is missing in the requested locale, fall back to Bulgarian
- **Logging:** Missing translations are logged (dev console + optional DB log) to help identify gaps
- **Admin dashboard:** "Missing translations" view shows which keys lack coverage in each language

Example: German user visits `/de/listings` but `listings.price_label` has no German translation → shows Bulgarian version

---

## Admin Interface for Translations

**Location:** `/[locale]/(app)/translations`  
**Access:** Admin-only

**Features:**

1. **Translation grid**
   - Rows: Translation keys (grouped by context)
   - Columns: Supported locales
   - Cells: Editable inline with save button

2. **Filters & Search**
   - Filter by context (ui, content, error, form)
   - Search by key name or partial content

3. **Status dashboard**
   - Completeness % per locale (e.g., "EN: 98%, DE: 85%, RU: 72%")
   - Count of missing translations per locale

4. **Bulk actions (Phase 2)**
   - Import JSON to seed/update
   - Export CSV for external translation
   - Mark translations as "reviewed" / "needs review"

**Minimal MVP:**
- Simple table with key, locale, value columns
- Add/edit/delete buttons
- Save to database on submit
- Admin role check

---

## Migration Strategy

### Phase 1: Database & Configuration Setup
1. Create migration script to add `locales`, `translation_keys`, `translations` tables
2. Install `next-intl` package
3. Configure `next.config.ts`, middleware, `i18n/*` files
4. Create language selector component

### Phase 2: Extract & Seed Translations
1. Run extraction script to scan `.tsx` files for hardcoded strings
2. Create `translation_keys` entries for each unique string
3. Populate `translations` table:
   - Bulgarian (BG): Copy source strings (assume UI is conceptually Bulgarian)
   - English (EN): Current hardcoded English strings
4. Generate drafts for German (DE) and Russian (RU) via Google Translate API (optional)

### Phase 3: Update Components
1. Replace hardcoded strings with `t()` calls
2. Update server components: `const t = await getTranslations('...')`
3. Update client components: `const t = useTranslations('...')`
4. Test fallback behavior (disable a locale temporarily to verify Bulgarian fallback works)
5. Incrementally migrate components (doesn't need to be all-at-once)

### Phase 4: Admin UI & Polish
1. Build translation management interface
2. Test pluralization and formatting with native speakers
3. Refine translations based on feedback
4. Deploy and monitor for missing keys

---

## Testing & Validation

### Manual Testing Checklist

- [ ] Navigate to `/bg/listings`, `/en/listings`, `/de/listings`, `/ru/listings` → correct language displays
- [ ] Click language selector → URL changes, cookie is set, page refreshes with new language
- [ ] Close tab, visit `/listings` (no locale in URL) → redirect to `/bg/listings` (default locale)
- [ ] Disable German translation in admin UI → German user sees Bulgarian fallback
- [ ] Test pluralization: set count=1, count=5, count=0 → correct plural form shows (if applicable to language rules)
- [ ] Test date/number formatting: change locale → dates/numbers format correctly (e.g., German: 1.500,50 €)
- [ ] Test interpolation: `t('greeting', { name: 'John' })` → shows "Hello John"

### Error Handling

- **Invalid locale in URL** (e.g., `/es/listings`): Middleware redirects to default locale (`/bg/listings`)
- **Missing translation key**: Logs warning, falls back to Bulgarian
- **Database connection error during translation load**: Falls back to cached translations or hard-coded defaults (TBD in Phase 3)

---

## Scalability & Future Enhancements

- **Adding a new language:** Add row to `locales` table, populate `translations`, no code changes needed
- **Language-specific branding:** Can store locale preferences (RTL support, date formats, currency) in `locales` table
- **Translation versioning:** Add `version` column to `translations` to track changes over time
- **Crowdsourcing:** Connect admin UI to translation service (Crowdin, Lokalise) for external contributors
- **Performance:** Cache translations in-memory or Redis; invalidate cache when admin updates a key

---

## Timeline & Effort Estimate

| Phase | Tasks | Duration | Effort |
|-------|-------|----------|--------|
| 1 | Setup next-intl, DB schema, middleware config | Week 1 | 2-3 days |
| 2 | Extract strings, seed translations (BG + EN), draft DE/RU | Week 2 | 2-3 days |
| 3 | Update components, test fallback, migrate incrementally | Week 3-4 | 3-4 days |
| 4 | Admin UI, refinement, deployment | Week 4+ | 2-3 days |

**Total:** ~2 weeks for MVP (Phases 1-3), add 1 week for admin UI (Phase 4) if desired upfront.

---

## Open Questions & Decisions

- **Caching strategy:** Should translations be cached in-memory after first load, or queried on each request? (Recommend: in-memory with cache invalidation on admin update)
- **Missing key fallback location:** Store hard-coded defaults in code, or trust DB fallback to Bulgarian? (Recommend: trust DB fallback)
- **Approval/review workflow:** Should translations be marked as "pending review" before going live? (Out of scope for MVP, can add later)
- **RTL support:** Not needed for these languages; can add later if expanding to Arabic/Hebrew

---

## Success Criteria

✅ Users can switch language via URL (`/bg/*`, `/en/*`, `/de/*`, `/ru/*`)  
✅ Language preference persists across visits (cookie)  
✅ Editors can manage translations via admin UI without code changes  
✅ Missing translations fall back to Bulgarian gracefully  
✅ Date, number, and currency formatting respects user's locale  
✅ Pluralization works correctly for all 4 languages  
✅ No performance regression (translations load quickly)  
✅ All hardcoded UI strings are translatable  
