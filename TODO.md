# TODO — Architecture follow-ups

Continuation file for the June 2026 architecture review. Work top-to-bottom;
each item is self-contained so a fresh session can pick up cold. Mark items
`[x]` with the commit hash when done. Context for what's already finished is
at the bottom.

## Remaining work (ranked by value per effort)

### 1. [ ] Automated database backups (~30 min)

Everything lives in one SQLite file (`DB_PATH`, default `../scraped/listings.db`):
scraped history, editable drafts, encrypted dealer credentials, tasks. Today's
"backups" are ad-hoc manual copies (`listings.db copy`, `listings.db.bak-20260611-060905`).

- Add `scripts/backup-db.ts`: open DB read-only, use better-sqlite3 `.backup()`
  API to `../scraped/backups/listings-YYYYMMDD-HHmm.db`, then rotate
  (keep 7 daily + 4 weekly). Do NOT `cp` the file — WAL mode makes raw copies
  inconsistent; the backup API is the safe path.
- Add npm script `backup:db`, document a launchd/cron line in README.
- Acceptance: run it twice, verify rotation and that the backup opens with
  `sqlite3 <file> "PRAGMA integrity_check;"`.

### 2. [ ] Single migration system with applied-state tracking (~2-3 h)

Two parallel systems exist: numbered files in `drizzle/` and hand-applied SQL
in `scripts/*.sql`, with no tracking table and already one prefix collision
(`0003_normalize_mobilebg_backup_vat.sql` vs `0003_drop_cars_synced_at.sql`).

- Create `applied_migrations` table (filename, applied_at).
- Add `scripts/migrate.ts`: applies pending files from one ordered folder
  (decide: keep `drizzle/` as the home; move still-relevant `scripts/*.sql`
  there with new numbers; archive already-applied one-offs to `scripts/applied/`).
- Backfill: mark everything currently in the live schema as applied.
- npm script `migrate`. Acceptance: running twice is a no-op; a new test
  migration applies exactly once.

### 3. [ ] Run `next build` in CI (~5 min)

`.github/workflows/ci.yml` runs lint + typecheck + vitest but not the build —
Next route typing and server/client-boundary errors only surface in `next build`.
Add `- run: npm run build` after tests. May need a dummy
`CREDENTIALS_ENCRYPTION_KEY` env (64 hex chars) — see `lib/env.ts` for what
`validateEnv()` requires at build/start.

### 4. [ ] Parser canary tests + zero-listings alarm (~half day)

Scrapers break when mobile.bg/cars.bg change their DOM, silently.

- Save current HTML fixtures (a search results page, a listing detail page)
  under `tests/fixtures/html/`.
- Unit-test the pure parsing modules against them:
  `lib/mobile-bg/scrape-parsing.ts`, `lib/mobile-bg/search-result-parsing.ts`,
  `lib/cars-bg/parse.ts`, repost form-field building
  (`lib/mobile-bg/repost-form-fields.ts`).
- In `scraper/scripts/run-for-ui.ts` / `run-carsbg-for-ui.ts`: when a dealer
  that previously had listings yields 0, emit `{type:'error'}` (or a loud
  warning event) instead of completing as success. Compare against
  `mobilebg_backup_runs.listings_count` of the last completed run.

### 5. [ ] Per-job watchdog limits (~1 h)

`MAX_CHILD_JOB_MS` in `lib/api/child-stream.ts` is a flat 15 min for all jobs —
too tight for deep crawls with image downloads, looser than needed for a single
repost. Add optional `maxRuntimeMs` to `ChildJobRun` (interface in
child-stream.ts), default to current 15 min; set higher in
`app/api/scrape/route.ts` prepare() for deep crawls, lower for
mobilebg single actions. Extend `tests/child-stream.test.ts` with a short-limit
job that gets killed (assert non-zero close code).

### 6. [ ] Component-size cleanup (mechanical, do piecemeal)

CLAUDE.md's own rule is <200 lines. Worst offenders:
`app/[locale]/(app)/dealers/[id]/credentials/page.tsx` (475),
`components/NewListingForm.tsx` (383), `components/AppSidebar.tsx` (362),
`components/FilterBar.tsx` (335), `app/[locale]/(app)/tasks/[id]/page.tsx` (333),
`templates/editor/[configId]/EditorClient.tsx` (331),
`components/MobileBgSearchResultsTable.tsx` (313).
Split by extracting subcomponents/hooks; no behavior changes; verify with build.

### 7. [ ] Small polish items (~15 min each)

- [ ] `proxy.ts`: replace the hand-rolled Map+expiry dealer-domain cache with
  `createTtlCache` from `lib/ttl-cache.ts`.
- [ ] `DB_PATH` default is cwd-relative (`path.join(process.cwd(), '../scraped/listings.db')`
  in `lib/storage-paths.ts`; a second copy in `scraper/lib/runner.ts` resolves
  from `import.meta.url`). Unify on one resolution (env-first, repo-relative
  fallback) so behavior doesn't depend on launch directory.
- [ ] Archive one-shot scripts (`scripts/insert-keys-4..11.ts`,
  `insert-missing-keys-3.ts`, applied `migrate-*.sql`) into `scripts/applied/`.
- [ ] NextAuth v5 is still beta — upgrade when stable releases.

## Done (June 2026) — context for resuming

- Architecture review + 5-step roadmap fully executed; see commits
  `166ba41` (Playwright out of API routes, `mobilebg_backups` indexes,
  auth-coverage test), `c65a8b4` (jobs survive client disconnect; SSE is an
  observer with replay; re-POST attaches; DELETE is the only kill path),
  `7f1a486` (characterization tests `tests/listing-queries.test.ts` over
  fixture `tests/fixtures/schema.sql` — regenerate from live DB `.schema`
  minus FTS shadow tables when schema changes), `48649e1` (untracked
  `db/data.db`), `b0564ae` (COUNT(*) OVER () collapses duplicate count queries).
- Reviewed-and-rejected refactors are recorded in CLAUDE.md
  ("Deliberate Non-Refactors") — don't re-propose them.
- Test conventions: auth mocking pattern in `tests/auth-helpers.test.ts`;
  child-process integration pattern in `tests/child-stream.test.ts` with
  `tests/fixtures/slow-emitter.ts`; characterization tests verified by
  mutation (break an expr in `lib/query-modules/types.ts`, expect failures).
- A second Claude session often works in this repo in parallel: check
  `git status` for foreign modified files and commit only your own.
