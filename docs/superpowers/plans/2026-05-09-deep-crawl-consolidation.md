# Deep Crawl Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the login-based Mobile.bg backup scraper and make deep crawl the single data collection path for all dealers, with optional local image download and automatic draft seeding for own dealers.

**Architecture:** Deep crawl (`run-for-ui.ts`) gains three new capabilities: crawl run tracking (writes to renamed `mobilebg_crawl_runs` table), optional image download to disk (toggle flag), and draft seeding for own dealers (INSERT OR IGNORE into `mobilebg_backups` during DETAIL handling). All backup scraper code is deleted. The `mobilebg_backups` table stays as the editable draft layer for editown/sync. `mobilebg_backup_images` stays as the local image store (now written by deep crawl instead of backup scraper).

**Tech Stack:** SQLite + better-sqlite3, Next.js App Router, TypeScript, Playwright/Crawlee, Tailwind CSS

> **Spec deviation — mobilebg_backup_images:** The design spec listed this table for deletion, but it cannot be dropped. It is read by `lib/listing-thumb.ts`, `lib/mobile-bg/own-search-ranks.ts`, `lib/facebook-marketplace/listing-payload.ts`, and `app/(app)/editown/new/page.tsx` via `first_backup_image_id`. It is served by `app/api/mobilebg-backup-images/[id]/route.ts`. Dropping it would break thumbnails and FB marketplace payloads for own listings. The table stays and is now written by the deep crawl image download instead of the backup scraper.

> **upsertListing return value:** The current `upsertListing` function does not return the listing `id`. Task 13 requires the id to link `mobilebg_backups` records. The plan includes a step to fetch the id with a follow-up SELECT after upsert.

---

## File Map

**Deleted:**
- `scraper/scripts/mobilebg-backup.ts`
- `lib/mobile-bg/backup.ts`
- `lib/mobile-bg/backup-db.ts`
- `lib/mobile-bg/backup-scraper.ts`
- `lib/mobile-bg/backup-types.ts`
- `app/api/mobilebg/backup/route.ts`
- `app/api/mobilebg/backups/[id]/route.ts`
- `app/api/mobilebg/crawl-queue/route.ts`
- `app/(app)/mobilebg/backups/page.tsx`
- `app/(app)/mobilebg/backups/[id]/page.tsx`
- `app/(app)/mobilebg/crawl-queue/page.tsx`

**Created:**
- `scripts/migrate-crawl-runs.sql` — rename table, add columns, drop crawl_queue

**Modified:**
- `db/schema.ts` — rename mobileBgBackupRuns → mobileBgCrawlRuns, remove mobileBgCrawlQueue
- `lib/query-modules/types.ts` — rename MobileBgBackupRunRow → MobileBgCrawlRunRow
- `lib/query-modules/mobilebg.ts` — rename/update run query functions, add create/update helpers, remove backup-only functions
- `components/AppSidebar.tsx` — remove Backups nav item
- `components/MobileBgActionPanel.tsx` — remove backup button
- `components/new-listing-form/SavedDraftView.tsx` — remove dead link to /mobilebg/backups
- `app/(app)/mobilebg/page.tsx` — replace backup runs section with crawl runs
- `components/scrape-runner/ScrapeControls.tsx` — add downloadImages toggle
- `components/ScrapeRunner.tsx` — add downloadImages state, pass to API
- `app/api/scrape/route.ts` — accept downloadImages param
- `scraper/lib/runner.ts` — parse --download-images flag
- `scraper/scripts/run-for-ui.ts` — crawl run tracking, image download, draft seeding

---

## Task 1: DB Migration

**Files:**
- Create: `scripts/migrate-crawl-runs.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- scripts/migrate-crawl-runs.sql

-- Rename backup_runs to crawl_runs
ALTER TABLE mobilebg_backup_runs RENAME TO mobilebg_crawl_runs;

-- Add image tracking columns
ALTER TABLE mobilebg_crawl_runs ADD COLUMN images_downloaded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mobilebg_crawl_runs ADD COLUMN images_failed INTEGER NOT NULL DEFAULT 0;

-- Drop crawl_queue (backed by backup scraper, no longer used)
DROP TABLE IF EXISTS mobilebg_crawl_queue;
```

- [ ] **Step 2: Apply migration**

```bash
sqlite3 /Users/v/dev/scraped/listings.db < scripts/migrate-crawl-runs.sql
```

Expected: no errors. Verify:

```bash
sqlite3 /Users/v/dev/scraped/listings.db ".schema mobilebg_crawl_runs"
```

Expected output includes `images_downloaded` and `images_failed` columns.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-crawl-runs.sql
git commit -m "chore: rename mobilebg_backup_runs → crawl_runs, drop crawl_queue"
```

---

## Task 2: Update Drizzle Schema

**Files:**
- Modify: `db/schema.ts`

- [ ] **Step 1: Rename the table export and add new columns**

In `db/schema.ts`, find the `mobileBgBackupRuns` export (~line 360) and replace the entire declaration:

```ts
export const mobileBgCrawlRuns = sqliteTable("mobilebg_crawl_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id").references(() => dealers.id),
  status: text("status").notNull().default("pending"),
  sourceUrl: text("source_url"),
  listingsCount: integer("listings_count").default(0),
  imagesCount: integer("images_count").default(0),
  imagesDownloaded: integer("images_downloaded").default(0),
  imagesFailed: integer("images_failed").default(0),
  notes: text("notes"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});
```

- [ ] **Step 2: Update the FK reference in mobileBgBackups**

Find `mobileBgBackups` and update the `runId` FK reference:

```ts
runId: integer("run_id").references(() => mobileBgCrawlRuns.id),
```

- [ ] **Step 3: Remove mobileBgCrawlQueue export**

Delete the entire `mobileBgCrawlQueue` export block (~line 513 to end of its declaration).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about deleted backup files (which we'll fix in later tasks), not about schema.

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts
git commit -m "chore: update drizzle schema for crawl_runs rename"
```

---

## Task 3: Update Query Types

**Files:**
- Modify: `lib/query-modules/types.ts`

- [ ] **Step 1: Rename MobileBgBackupRunRow and add new fields**

Find `MobileBgBackupRunRow` (~line 78) and rename + extend it:

```ts
export interface MobileBgCrawlRunRow {
  id: number;
  status: string;
  source_url: string | null;
  listings_count: number;
  images_count: number;
  images_downloaded: number;
  images_failed: number;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
}
```

- [ ] **Step 2: Update MobileBgDashboardSummary — remove images count**

Find `MobileBgDashboardSummary` (~line 70) and update:

```ts
export interface MobileBgDashboardSummary {
  crawlRuns: number;
  backups: number;
  editForms: number;
  repostJobs: number;
}
```

(Removed `runs` and `images` fields; renamed to `crawlRuns`.)

- [ ] **Step 3: Commit**

```bash
git add lib/query-modules/types.ts
git commit -m "chore: rename MobileBgBackupRunRow → MobileBgCrawlRunRow, update summary type"
```

---

## Task 4: Update Query Functions

**Files:**
- Modify: `lib/query-modules/mobilebg.ts`

- [ ] **Step 1: Update imports at top of file**

Replace the import line to remove deleted types and use new name:

```ts
import type { EditOwnSyncRow, MakeModelMappingRow, MobileBgBackupDetailRow, MobileBgBackupImageRow, MobileBgCrawlRunRow, MobileBgDashboardSummary, MobileBgEditFormDetailRow, MobileBgEditFormRow, MobileBgRepostJobRow } from './types';
```

(Removed `MobileBgBackupRunRow`, `MobileBgBackupListRow`; added `MobileBgCrawlRunRow`.)

- [ ] **Step 2: Update getMobileBgDashboardSummary**

Replace the entire function:

```ts
export function getMobileBgDashboardSummary(): MobileBgDashboardSummary {
  const crawlRuns = raw
    .prepare(`SELECT COUNT(*) as count FROM mobilebg_crawl_runs`)
    .get() as { count: number };
  const backups = raw
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM (
      SELECT 1
      FROM mobilebg_backups
      GROUP BY dealer_id, mobile_id
    )
  `,
    )
    .get() as { count: number };
  const editForms = raw
    .prepare(`SELECT COUNT(*) as count FROM mobilebg_edit_form_snapshots`)
    .get() as { count: number };
  const repostJobs = raw
    .prepare(`SELECT COUNT(*) as count FROM mobilebg_repost_jobs`)
    .get() as { count: number };
  return {
    crawlRuns: crawlRuns.count,
    backups: backups.count,
    editForms: editForms.count,
    repostJobs: repostJobs.count,
  };
}
```

- [ ] **Step 3: Rename getMobileBgBackupRuns → getMobileBgCrawlRuns**

Replace the entire function:

```ts
export function getMobileBgCrawlRuns(limit = 20): MobileBgCrawlRunRow[] {
  return raw
    .prepare(
      `
    SELECT
      r.id, r.status, r.source_url, r.listings_count, r.images_count,
      r.images_downloaded, r.images_failed, r.notes,
      r.started_at, r.finished_at, r.created_at, r.updated_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_crawl_runs r
    LEFT JOIN dealers d ON r.dealer_id = d.id
    ORDER BY COALESCE(r.started_at, r.created_at) DESC, r.id DESC
    LIMIT ?
  `,
    )
    .all(limit) as MobileBgCrawlRunRow[];
}
```

- [ ] **Step 4: Add createCrawlRun and updateCrawlRun helpers**

Add these two functions after `getMobileBgCrawlRuns`:

```ts
export function createCrawlRun(dealerId: number, sourceUrl: string): number {
  const now = new Date().toISOString();
  const result = raw
    .prepare(
      `
    INSERT INTO mobilebg_crawl_runs (dealer_id, source_url, status, started_at, created_at, updated_at)
    VALUES (?, ?, 'running', ?, ?, ?)
  `,
    )
    .run(dealerId, sourceUrl, now, now, now);
  return result.lastInsertRowid as number;
}

export function updateCrawlRun(
  runId: number,
  data: {
    status: 'completed' | 'failed';
    listingsCount: number;
    imagesDownloaded: number;
    imagesFailed: number;
  },
): void {
  const now = new Date().toISOString();
  raw
    .prepare(
      `
    UPDATE mobilebg_crawl_runs
    SET status = ?, listings_count = ?, images_downloaded = ?, images_failed = ?,
        finished_at = ?, updated_at = ?
    WHERE id = ?
  `,
    )
    .run(
      data.status,
      data.listingsCount,
      data.imagesDownloaded,
      data.imagesFailed,
      now,
      now,
      runId,
    );
}
```

- [ ] **Step 5: Remove getMobileBgBackups and getMobileBgBackupById**

Delete the `getMobileBgBackups` function and the `getMobileBgBackupById` function entirely — they are only called from the pages we're deleting (`/mobilebg/backups` and `/mobilebg/backups/[id]`).

Also remove the `MobileBgBackupListRow` type import and `MobileBgBackupImageRow` import if it's only used in `getMobileBgBackupById`. Check: `MobileBgBackupImageRow` is used in `getMobileBgBackupById` return type only — remove it from the import.

- [ ] **Step 6: Verify TypeScript compiles (ignoring deleted files)**

```bash
npx tsc --noEmit 2>&1 | grep -v "backup\." | head -20
```

- [ ] **Step 7: Commit**

```bash
git add lib/query-modules/mobilebg.ts
git commit -m "chore: update mobilebg queries for crawl_runs, add create/update helpers"
```

---

## Task 5: Delete Backup Scraper Files

**Files:**
- Delete: `scraper/scripts/mobilebg-backup.ts`
- Delete: `lib/mobile-bg/backup.ts`
- Delete: `lib/mobile-bg/backup-db.ts`
- Delete: `lib/mobile-bg/backup-scraper.ts`
- Delete: `lib/mobile-bg/backup-types.ts`

(Keep `lib/mobile-bg/backup-images.ts` — it has `normalizeImageUrl` and `toMobileBgFullImageUrl` helpers that will be used by the deep crawl image download.)

- [ ] **Step 1: Delete the files**

```bash
rm scraper/scripts/mobilebg-backup.ts
rm lib/mobile-bg/backup.ts
rm lib/mobile-bg/backup-db.ts
rm lib/mobile-bg/backup-scraper.ts
rm lib/mobile-bg/backup-types.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: remove backup scraper files"
```

---

## Task 6: Delete Backup API Routes

**Files:**
- Delete: `app/api/mobilebg/backup/` (entire directory)
- Delete: `app/api/mobilebg/backups/` (entire directory — contains `[id]/route.ts`)
- Delete: `app/api/mobilebg/crawl-queue/route.ts`

- [ ] **Step 1: Delete the route files**

```bash
rm -rf "app/api/mobilebg/backup"
rm -rf "app/api/mobilebg/backups"
rm "app/api/mobilebg/crawl-queue/route.ts"
rmdir "app/api/mobilebg/crawl-queue"
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: remove backup API routes and crawl-queue API"
```

---

## Task 7: Delete Backup UI Pages

**Files:**
- Delete: `app/(app)/mobilebg/backups/` (entire directory including `[id]/`)
- Delete: `app/(app)/mobilebg/crawl-queue/` (entire directory)

Also delete the supporting component used only by the crawl-queue page:
- Delete: `components/CrawlQueueFilterBar.tsx` (if only used by crawl-queue page)

- [ ] **Step 1: Verify CrawlQueueFilterBar.tsx is only used by crawl-queue page**

```bash
grep -r "CrawlQueueFilterBar" app components lib --include="*.tsx" --include="*.ts"
```

Expected: only `app/(app)/mobilebg/crawl-queue/page.tsx` references it.

- [ ] **Step 2: Delete the pages and component**

```bash
rm -rf "app/(app)/mobilebg/backups"
rm -rf "app/(app)/mobilebg/crawl-queue"
rm components/CrawlQueueFilterBar.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: remove backups and crawl-queue UI pages"
```

---

## Task 8: Update mobilebg/page.tsx

**Files:**
- Modify: `app/(app)/mobilebg/page.tsx`

- [ ] **Step 1: Update imports**

Replace the import line:

```ts
import { getAllDealers, getMobileBgCrawlRuns, getMobileBgDashboardSummary, getMobileBgEditForms, getMobileBgRepostJobs } from '@/lib/queries';
```

- [ ] **Step 2: Replace the page body**

Replace the entire component:

```tsx
export default function MobileBgPage() {
  const summary = getMobileBgDashboardSummary();
  const runs = getMobileBgCrawlRuns(8);
  const editForms = getMobileBgEditForms(8);
  const reposts = getMobileBgRepostJobs(8);
  const dealers = getAllDealers().filter((dealer) => dealer.active && dealer.mobile_url);

  const cards = [
    { label: 'Crawl runs', value: summary.crawlRuns },
    { label: 'Draft listings', value: summary.backups },
    { label: 'Edit form snapshots', value: summary.editForms },
    { label: 'Repost jobs', value: summary.repostJobs },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mobile.bg</h1>
        <p className="mt-1 text-sm text-gray-400">
          Edit-form and repost artifacts for mobile.bg own listings.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <MobileBgActionPanel
        dealers={dealers.map((dealer) => ({ slug: dealer.slug, name: dealer.name }))}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-gray-700 bg-gray-900/40">
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
            <h2 className="text-sm font-medium text-gray-200">Recent Crawl Runs</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {runs.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No crawl runs yet.</div>
            ) : runs.map((run) => (
              <div key={run.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{run.dealer_name ?? 'Unknown dealer'}</div>
                  <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{run.status}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {run.listings_count} listings
                  {run.images_downloaded > 0 && ` • ${run.images_downloaded} images`}
                  {' • '}{formatDate(run.started_at || run.created_at)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-700 bg-gray-900/40">
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
            <h2 className="text-sm font-medium text-gray-200">Recent Edit Forms</h2>
            <Link href="/mobilebg/edit-forms" className="text-xs text-blue-300 hover:text-blue-200">Open edit forms</Link>
          </div>
          <div className="divide-y divide-gray-800">
            {editForms.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No edit form snapshots yet.</div>
            ) : editForms.map((entry) => (
              <Link key={entry.id} href={`/mobilebg/edit-forms/${entry.id}`} className="block px-4 py-3 text-sm hover:bg-gray-800/40">
                <div className="font-medium text-white">{entry.row_title || entry.mobile_id || `Snapshot #${entry.id}`}</div>
                <div className="mt-1 text-xs text-gray-400">{entry.dealer_name ?? 'Unknown dealer'} • {formatDate(entry.created_at)}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-700 bg-gray-900/40">
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
            <h2 className="text-sm font-medium text-gray-200">Recent Reposts</h2>
            <Link href="/mobilebg/reposts" className="text-xs text-blue-300 hover:text-blue-200">Open reposts</Link>
          </div>
          <div className="divide-y divide-gray-800">
            {reposts.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No repost jobs yet.</div>
            ) : reposts.map((job) => (
              <div key={job.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{job.backup_title || job.source_mobile_id || `Job #${job.id}`}</div>
                  <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{job.status}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400">{job.dealer_name ?? 'Unknown dealer'} • {formatDate(job.created_at)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/mobilebg/page.tsx"
git commit -m "feat: update mobilebg dashboard — replace backup runs with crawl runs"
```

---

## Task 9: Update Navigation and Action Panel

**Files:**
- Modify: `components/AppSidebar.tsx`
- Modify: `components/MobileBgActionPanel.tsx`
- Modify: `components/new-listing-form/SavedDraftView.tsx`

- [ ] **Step 1: Remove Backups nav item from AppSidebar.tsx**

Find and delete the line:

```ts
{ href: '/mobilebg/backups', label: 'Backups', icon: ArchiveIcon, indent: true },
```

- [ ] **Step 2: Remove backup functionality from MobileBgActionPanel.tsx**

Open `components/MobileBgActionPanel.tsx`. The component triggers a backup run via `/api/mobilebg/backup`. Remove:
- The `backupRunning` state
- The `backupLog` state
- The `runBackup` async function
- The backup button in the JSX
- The backup log display in the JSX
- Any types/interfaces only used for backup log entries (e.g. `BackupLogEntry`)

Keep the rest of the component intact (dealer selection, other buttons for edit-form capture, repost).

- [ ] **Step 3: Remove dead /mobilebg/backups link from SavedDraftView.tsx**

Open `components/new-listing-form/SavedDraftView.tsx`. Find the link that points to `/mobilebg/backups/${backupId}` and remove it (or replace with plain text if the UI needs something there).

- [ ] **Step 4: Commit**

```bash
git add components/AppSidebar.tsx components/MobileBgActionPanel.tsx "components/new-listing-form/SavedDraftView.tsx"
git commit -m "feat: remove backup nav, backup button, and dead backup link"
```

---

## Task 10: Add downloadImages Toggle to Scrape UI

**Files:**
- Modify: `components/scrape-runner/ScrapeControls.tsx`
- Modify: `components/ScrapeRunner.tsx`

- [ ] **Step 1: Update ScrapeControls props interface**

In `components/scrape-runner/ScrapeControls.tsx`, add to the `ScrapeControlsProps` interface:

```ts
downloadImages: boolean;
onToggleDownloadImages: () => void;
```

- [ ] **Step 2: Add downloadImages to destructured props**

```ts
export function ScrapeControls({
  source,
  running,
  stopping,
  deepCrawl,
  downloadImages,
  activeDealers,
  availableDealers,
  effectiveSelected,
  allActiveSelected,
  onSourceChange,
  onToggleDealer,
  onToggleSelectAllDealers,
  onToggleDeepCrawl,
  onToggleDownloadImages,
  onRunClick,
}: ScrapeControlsProps) {
```

- [ ] **Step 3: Add the toggle UI after the deep crawl toggle**

In the JSX, after the existing deep crawl toggle `<div>`, add:

```tsx
<div
  onClick={onToggleDownloadImages}
  className={`flex items-center gap-3 ${(running || !deepCrawl) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
>
  <div
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${downloadImages && deepCrawl ? 'bg-blue-600' : 'bg-gray-600'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${downloadImages && deepCrawl ? 'translate-x-6' : 'translate-x-1'}`} />
  </div>
  <div>
    <span className="text-sm font-medium text-gray-200">Download images</span>
    <p className="mt-0.5 text-xs text-gray-400">Save full-res images to disk (requires deep crawl)</p>
  </div>
</div>
```

- [ ] **Step 4: Update ScrapeRunner.tsx**

Add `downloadImages` state and wire it up:

```ts
const [downloadImages, setDownloadImages] = useState(false);
```

In the fetch call, add `downloadImages` to the body:

```ts
body: JSON.stringify({ dealers: dealerSelection.effectiveSelected, deepCrawl, downloadImages, source: dealerSelection.source }),
```

Pass new props to `ScrapeControls`:

```tsx
downloadImages={downloadImages}
onToggleDownloadImages={() => !running && deepCrawl && setDownloadImages((v) => !v)}
```

Also reset `downloadImages` to false when `deepCrawl` is turned off. Add this effect after the existing state declarations:

```ts
useEffect(() => {
  if (!deepCrawl) setDownloadImages(false);
}, [deepCrawl]);
```

- [ ] **Step 5: Commit**

```bash
git add components/scrape-runner/ScrapeControls.tsx components/ScrapeRunner.tsx
git commit -m "feat: add download images toggle to scrape controls"
```

---

## Task 11: Update /api/scrape Route and Runner Args

**Files:**
- Modify: `app/api/scrape/route.ts`
- Modify: `scraper/lib/runner.ts`

- [ ] **Step 1: Update /api/scrape/route.ts to accept downloadImages**

```ts
export async function POST(req: NextRequest) {
  const { dealers, deepCrawl, downloadImages, source } = await req.json();

  state.clearStale();

  if (state.child) {
    return new Response(JSON.stringify({ error: 'A scraper run is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scriptArgs = ['--dealers', (dealers as string[]).join(',')];
  if (deepCrawl) scriptArgs.push('--deep');
  if (downloadImages && deepCrawl) scriptArgs.push('--download-images');

  // ... rest unchanged
```

- [ ] **Step 2: Update parseRunnerArgs in scraper/lib/runner.ts**

```ts
export function parseRunnerArgs(args = process.argv.slice(2)) {
  const dealersIdx = args.indexOf("--dealers");
  const dealerArg =
    dealersIdx !== -1 && args[dealersIdx + 1] ? args[dealersIdx + 1] : "";

  return {
    deepCrawl: args.includes("--deep"),
    downloadImages: args.includes("--download-images"),
    requestedSlugs: dealerArg ? dealerArg.split(",").map((s) => s.trim()) : [],
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/scrape/route.ts scraper/lib/runner.ts
git commit -m "feat: add --download-images flag to scrape API and runner args"
```

---

## Task 12: Update run-for-ui.ts — Types and Imports

**Files:**
- Modify: `scraper/scripts/run-for-ui.ts`

- [ ] **Step 1: Update parseRunnerArgs import to include downloadImages**

At the top of the file, `parseRunnerArgs` is already imported from `@/scraper/lib/runner`. Update the destructuring on line 32:

```ts
const { deepCrawl, downloadImages, requestedSlugs } = parseRunnerArgs();
```

- [ ] **Step 2: Update DealerRow interface to include own and mobile_user**

Find the `DealerRow` interface (~line 107) and add the missing fields:

```ts
interface DealerRow {
  id: number;
  slug: string;
  name: string;
  mobileBg: string;
  own: number;        // 1 = own dealer, 0 = competitor
  mobile_user: string | null;
}
```

- [ ] **Step 3: Add imports needed for crawl run tracking and image download**

Add near the top of the file (after existing imports):

```ts
import fs from "fs";
import path from "path";
import { createCrawlRun, updateCrawlRun } from "@/lib/query-modules/mobilebg";
import { SCRAPED_ROOT } from "@/lib/storage-paths";
```

- [ ] **Step 4: Commit**

```bash
git add scraper/scripts/run-for-ui.ts
git commit -m "chore: add downloadImages, own fields, and crawl run imports to run-for-ui"
```

---

## Task 13: Update run-for-ui.ts — Draft Seeding and Image Download

**Files:**
- Modify: `scraper/scripts/run-for-ui.ts`

This task adds two things to the DETAIL request handler: draft seeding (INSERT OR IGNORE into mobilebg_backups) and image download. Both happen only for own dealers.

- [ ] **Step 1: Return fullUrls from page.evaluate in the DETAIL handler**

In the DETAIL handler's `page.evaluate()` call (~line 904), add `fullUrls` to the return object so they're available in Node.js scope for downloading:

```ts
return {
  priceText,
  vatText,
  bodyText: document.body.innerText.substring(0, 5000),
  statistikiText,
  description,
  imgMeta,
  thumbKeys,
  fullKeys,
  fullUrls,          // ← add this
  firstThumbUrl: thumbUrls[0] || "",
  extras,
};
```

- [ ] **Step 2: Add draft seeding helper function**

Add this function before `scrapeCompetitorForUI`:

```ts
function seedDraft(
  db: Database.Database,
  dealer: DealerRow,
  listing: ScrapedListingInput,
  listingDbId: number,
): number | null {
  const mobileId = extractMobileId(listing.url ?? "");
  if (!mobileId) return null;
  const now = new Date().toISOString();
  const { regYear } = parseReg(listing.year ?? null);
  const result = db
    .prepare(
      `
    INSERT OR IGNORE INTO mobilebg_backups
      (dealer_id, listing_id, mobile_id, source_url, title, make, model,
       price_amount, price_currency, description, year, mileage, fuel,
       transmission, color, category, extras_json, image_count,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      dealer.id,
      listingDbId,
      mobileId,
      listing.url,
      listing.title ?? null,
      null, // make resolved later via listing join
      null, // model resolved later via listing join
      listing.price?.amount ?? null,
      listing.price?.currency ?? "EUR",
      listing.description ?? null,
      regYear ? parseInt(regYear, 10) : null,
      listing.mileage ?? null,
      listing.fuel ?? null,
      listing.transmission ?? null,
      listing.color ?? null,
      listing.bodyType ?? null,
      listing.extras ? JSON.stringify(listing.extras) : null,
      listing.imageCount ?? 0,
      now,
      now,
    );
  if (result.changes === 0) {
    // row already exists — fetch its id
    const row = db
      .prepare(`SELECT id FROM mobilebg_backups WHERE dealer_id = ? AND mobile_id = ? LIMIT 1`)
      .get(dealer.id, mobileId) as { id: number } | undefined;
    return row?.id ?? null;
  }
  return result.lastInsertRowid as number;
}
```

- [ ] **Step 3: Add image download helper function**

Add this function right after `seedDraft`:

```ts
async function downloadListingImages(
  db: Database.Database,
  dealer: DealerRow,
  mobileId: string,
  backupId: number,
  fullUrls: string[],
): Promise<{ downloaded: number; failed: number }> {
  const dir = path.join(SCRAPED_ROOT, "mobilebg-backups", dealer.slug, mobileId);
  fs.mkdirSync(dir, { recursive: true });

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < fullUrls.length; i++) {
    const srcUrl = fullUrls[i];
    const keyMatch = srcUrl.match(/[^/_]+_([^.]+)\.webp$/);
    const key = keyMatch?.[1] ?? `img_${i}`;
    const filename = `${key}.webp`;
    const localPath = path.join(dir, filename);

    if (fs.existsSync(localPath)) {
      downloaded++; // already on disk
      continue;
    }

    try {
      const res = await fetch(srcUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(localPath, buf);

      const now = new Date().toISOString();
      db.prepare(
        `
      INSERT OR IGNORE INTO mobilebg_backup_images
        (backup_id, sort_order, filename, source_url, local_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      ).run(backupId, i, filename, srcUrl, localPath, now);

      downloaded++;
    } catch {
      failed++;
    }
  }

  return { downloaded, failed };
}
```

- [ ] **Step 4: Call seedDraft and downloadListingImages in the DETAIL handler**

In the DETAIL handler, after `await upsertListing(...)` returns `listingDbId`, add:

```ts
let imagesDownloaded = 0;
let imagesFailed = 0;

if (dealer.own === 1) {
  const backupId = seedDraft(db, dealer, listing, listingDbId);
  if (backupId && downloadImages && raw.fullUrls.length > 0) {
    const mobileId = extractMobileId(listing.url ?? "") ?? "unknown";
    const counts = await downloadListingImages(db, dealer, mobileId, backupId, raw.fullUrls);
    imagesDownloaded += counts.downloaded;
    imagesFailed += counts.failed;
  }
}
```

Note: `upsertListing` does not currently return the row id. After calling it, fetch the id with:

```ts
const listingRow = db
  .prepare(`SELECT id FROM listings WHERE dealer_id = ? AND mobile_id = ? LIMIT 1`)
  .get(dealer.id, extractMobileId(listing.url ?? "")) as { id: number } | undefined;
const listingDbId = listingRow?.id ?? null;
```

- [ ] **Step 5: Emit image download counts in the DETAIL handler log event**

After the download block, update the existing `emit` call to include image counts:

```ts
emit({
  type: "log",
  message: `[DETAIL] ${listing.title ?? url} — ${imagesDownloaded} images downloaded`,
});
```

- [ ] **Step 6: Commit**

```bash
git add scraper/scripts/run-for-ui.ts
git commit -m "feat: add draft seeding and image download to deep crawl DETAIL handler"
```

---

## Task 14: Add Crawl Run Tracking to run-for-ui.ts

**Files:**
- Modify: `scraper/scripts/run-for-ui.ts`

Crawl run records are created per-dealer at the start of scraping and updated at completion. Image counts are accumulated across all DETAIL handlers for that dealer.

- [ ] **Step 1: Pass runId and image accumulators through scrapeCompetitorForUI**

Update the `scrapeCompetitorForUI` function signature and body to accumulate image counts. The function already has a `count` variable for listing count. Add:

```ts
async function scrapeCompetitorForUI(
  dealer: DealerRow,
  db: Database.Database,
  makesMap: MakesMap | null,
  fuelMap: Map<string, string> | null,
  transmissionMap: Map<string, string> | null,
): Promise<{ count: number; imagesDownloaded: number; imagesFailed: number }> {
  let count = 0;
  let totalImagesDownloaded = 0;
  let totalImagesFailed = 0;
  // ... existing code ...
```

Wherever `imagesDownloaded` and `imagesFailed` are computed in the DETAIL handler (Task 13 Step 4), add them to the totals:

```ts
totalImagesDownloaded += imagesDownloaded;
totalImagesFailed += imagesFailed;
```

At the end of the function, return all three:

```ts
return { count, imagesDownloaded: totalImagesDownloaded, imagesFailed: totalImagesFailed };
```

- [ ] **Step 2: Create and update crawl run records in main()**

In the `main()` function, update the dealer loop:

```ts
for (const dealer of selected) {
  emit({ type: "log", message: `Starting scrape: ${dealer.name}` });
  const runId = createCrawlRun(dealer.id, dealer.mobileBg ?? "");
  try {
    const { count, imagesDownloaded, imagesFailed } = await scrapeCompetitorForUI(
      dealer,
      db,
      makesMap,
      fuelMap,
      transmissionMap,
    );
    updateCrawlRun(runId, { status: 'completed', listingsCount: count, imagesDownloaded, imagesFailed });
    emit({ type: "done", dealer: dealer.slug, count });
  } catch (err) {
    hadErrors = true;
    updateCrawlRun(runId, { status: 'failed', listingsCount: 0, imagesDownloaded: 0, imagesFailed: 0 });
    emit({
      type: "error",
      message: `Error scraping ${dealer.name}: ${formatError(err)}`,
    });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add scraper/scripts/run-for-ui.ts
git commit -m "feat: add crawl run tracking to run-for-ui"
```

---

## Task 15: Smoke Test and Fix TypeScript Errors

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Fix any remaining errors. Common ones to expect:
- `MobileBgBackupRunRow` used somewhere that wasn't updated → replace with `MobileBgCrawlRunRow`
- `getMobileBgBackupRuns` called somewhere → replace with `getMobileBgCrawlRuns`
- `summary.runs` or `summary.images` used in JSX → replace with `summary.crawlRuns`
- `MobileBgBackupListRow` or `MobileBgBackupImageRow` referenced somewhere → remove or replace

- [ ] **Step 2: Run ESLint**

```bash
npm run lint 2>&1 | head -40
```

Fix any lint errors.

- [ ] **Step 3: Start dev server and verify mobilebg page loads**

```bash
npm run dev
```

Navigate to `http://localhost:3000/mobilebg` — page should load with "Recent Crawl Runs" section (empty until a deep crawl runs). No "Backups" in sidebar. No backup button in action panel.

Navigate to `http://localhost:3000` — dashboard should load normally.

Navigate to `http://localhost:3000/editown` — listings should show as before.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve remaining TypeScript and lint errors after consolidation"
```

---

## Task 16: Verify Deep Crawl End-to-End

- [ ] **Step 1: Trigger a deep crawl without image download**

In the scrape UI, select one own dealer, enable Deep Crawl (leave Download Images off), click Run. Check:
- SSE log streams without errors
- `mobilebg_crawl_runs` has a new `completed` record: `sqlite3 /Users/v/dev/scraped/listings.db "SELECT * FROM mobilebg_crawl_runs ORDER BY id DESC LIMIT 3;"`
- `mobilebg_backups` has new records for own dealer listings: `sqlite3 /Users/v/dev/scraped/listings.db "SELECT COUNT(*) FROM mobilebg_backups WHERE dealer_id = (SELECT id FROM dealers WHERE own = 1 LIMIT 1);"`

- [ ] **Step 2: Trigger a deep crawl with image download**

Enable both Deep Crawl and Download Images, run for one own dealer with a small listing count. Check:
- SSE log shows image download events
- Files exist on disk: `ls /Users/v/dev/scraped/mobilebg-backups/{dealer-slug}/{mobile-id}/`
- `mobilebg_backup_images` has records: `sqlite3 /Users/v/dev/scraped/listings.db "SELECT COUNT(*) FROM mobilebg_backup_images ORDER BY id DESC;"`
- Run record has `images_downloaded > 0`

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup after deep crawl consolidation"
```
