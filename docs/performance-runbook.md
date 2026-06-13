# Performance Runbook

This app now has local guards for hot query plans, load checks, image cache headers, bounded stream logs, and lazy-loaded heavy client widgets. The remaining high-scale work needs deployment choices, so keep it explicit instead of hiding it in code comments.

## Before Release

1. Apply database migrations, including `drizzle/0039_add_public_listing_indexes.sql`.
2. Run `npm run perf:query-plans`.
3. Start the app and run a representative page load check:
   `LOAD_TEST_PATH=/d/example-dealer npm run perf:load`
4. Audit at least one listing image route:
   `IMAGE_AUDIT_URL=http://localhost:3000/api/images/example.webp npm run perf:image-cache`
5. Rebuild materialized facets after bulk listing changes:
   `npm run facets:rebuild`
6. Smoke-check local metrics collection:
   `npm run perf:metrics-smoke`

## Shared Cache

The current TTL caches are in-process. They reduce repeated SQLite work on one Node process, but each horizontally scaled instance warms its own cache.

For multi-instance production, replace or wrap the TTL cache users with a shared cache such as Redis:

- public dealer lookup by slug/domain
- public listing result pages
- public make facets
- related listings
- active dealer template config
- translation bundles

Use cache tags or key prefixes that can be invalidated after scrape/import/update jobs.

Suggested key shape:

- `dealer:slug:{slug}`
- `dealer:domain:{domain}`
- `dealer:{dealerId}:public-listings:{hash(filters)}`
- `dealer:{dealerId}:public-makes`
- `dealer:{dealerId}:related:{mobileId}:{make}:{limit}`
- `template:active:{dealerId}`
- `translations:{locale}`

Invalidation triggers:

- scrape/import completed for a dealer: purge `dealer:{dealerId}:public-*`, `dealer:{dealerId}:related:*`
- dealer public config changed: purge `dealer:slug:*`, `dealer:domain:*`, `template:active:{dealerId}`
- template activation/save: purge `template:active:{dealerId}` and public listing page cache for that dealer
- translation update: purge `translations:{locale}`

Rollout plan:

1. Add a small cache interface with `get`, `set`, `deleteByPrefix`, and `remember`.
2. Keep the current in-process TTL cache as the development implementation.
3. Add Redis implementation behind environment flags.
4. Add cache hit/miss counters before enabling in production.
5. Enable shared cache for read-only public queries first, then template/translations.

## Database Scale

SQLite with WAL is fast for this app's current single-node shape, but it is not the right long-term database for heavy concurrent public traffic and background writes.

Migration target:

- Postgres with pooled connections
- read replica for public listing and dealer pages
- online index creation for large tables
- query-plan monitoring in CI and production

Keep cursor pagination for public and listing pages. Avoid exact counts on hot paths unless they are cached or materialized.

Recommended migration phases:

1. Inventory raw SQL by module and group it by read/write path.
2. Introduce an adapter boundary for `raw.prepare(...).all/get/run` hot modules.
3. Port schema and migrations to Postgres-compatible SQL.
4. Backfill data into Postgres in a staging environment.
5. Run dual-read validation for public listing/detail queries.
6. Move background write jobs first if operationally safer, or move read-only public traffic first if the priority is page latency.
7. Add read replica routing for public dealer pages and listing detail pages.

Postgres index checklist:

- `listings(dealer_id, is_active, duplicate, last_edit, id)`
- `listings(dealer_id, is_active, duplicate, current_price, id)`
- `listings(dealer_id, is_active, duplicate, mileage, id)`
- `listings(dealer_id, is_active, duplicate, reg_year, id)`
- `listings(dealer_id, is_active, duplicate, make)`
- `listings(mobile_id)`
- `listings(cars_id)`
- `mobilebg_backups(dealer_id, mobile_id)`
- `mobilebg_backups(listing_id)`
- GIN or tsvector indexes for listing/task/article search, replacing SQLite FTS.

## Edge/Page Caching

Public dealer pages are cache-friendly because they change mainly after scrape/import/update jobs.

Recommended production shape:

- CDN cache public dealer listing pages with a short stale-while-revalidate window
- purge by dealer slug after sync jobs
- keep authenticated app routes private and uncached
- serve immutable listing images with long-lived cache headers

Suggested cache policy:

- public dealer listing pages: `s-maxage=60, stale-while-revalidate=300`
- public dealer detail pages: `s-maxage=300, stale-while-revalidate=600`
- inner content pages: `s-maxage=300, stale-while-revalidate=1800`
- immutable images: `public, max-age=31536000, immutable`
- authenticated app/API routes: `private, no-store`

Purge strategy:

- On scrape/import/update completion, purge by dealer slug.
- On template publish/activation, purge dealer public pages.
- On public content edits, purge only the changed inner page plus the dealer shell if navigation changed.
- On image replacement, prefer changing the image URL or id instead of purging immutable assets.

## Materialized Facets

Filter facets such as makes, fuels, years, categories, and price ranges should eventually be maintained during import/sync instead of recomputed from `listings`.

Recommended table shape:

- `dealer_listing_facets(dealer_id, facet_type, facet_value, listing_count, updated_at)`
- update in the same transaction as listing mutations where possible
- fall back to rebuild jobs after large imports

Facet types to materialize first:

- `make`
- `fuel`
- `reg_year`
- `body_type`
- `ad_status`
- `price_bucket`
- `mileage_bucket`

Implementation notes:

- Maintain exact facet counts only for active, non-duplicate listings.
- Use a rebuild command for safety after bulk imports.
- Prefer buckets for price/mileage instead of storing every value.
- Keep public filter UI backed by facet rows, not `SELECT DISTINCT` on `listings`.

Validation:

- Compare materialized facet counts to live aggregate SQL in staging.
- Alert if drift exceeds zero after import completion.
- Add query-plan checks so facet reads use `(dealer_id, facet_type, facet_value)`.

## Work Queues And Backpressure

The current app has per-process concurrency protection for poster generation and child-job single-run guards for scrape/sync flows. For horizontal scale, this needs a shared queue.

The local foundation is `InMemoryJobQueue` in `lib/queue/job-queue.ts`. It provides dedupe keys, bounded queue size, concurrency, queue age stats, and a worker interface. It is intentionally in-process only; replace the implementation with Redis/Postgres while preserving the same call shape.

Recommended queue shape:

- one queue for scrape/import jobs
- one queue for publish/update/repost jobs
- one queue for image/poster generation
- job keys that dedupe by dealer/action/listing where duplicate work is harmful

Required behavior:

- retries with exponential backoff
- per-dealer concurrency limits
- job cancellation for long browser actions
- persistent job state visible to the UI
- dead-letter tracking for repeated failures

Good candidates:

- Postgres-backed queue if migrating to Postgres
- Redis/BullMQ if Redis is already introduced for shared cache
- Vercel Queues or another managed queue if deploying on a platform with queue primitives

## Observability

Track these metrics before calling a performance pass complete:

- p95/p99 route latency for public dealer pages, listing search, image routes, and sync APIs
- slow query logs by `timedQuery` label
- cache hit/miss rate
- image route status and cache-control header coverage
- process memory during long streaming jobs
- poster generation 429 rate from the concurrency gate

Add dashboards for:

- public page p50/p95/p99 latency by dealer slug
- API p95/p99 latency by route
- SQLite/Postgres query time by `timedQuery` label
- cache hit rate by namespace
- queue depth and oldest job age
- image route bandwidth and cache status
- Node process RSS/heap usage
- child-process run duration and exit code

Alert thresholds to start with:

- public page p95 above 500 ms for 10 minutes
- API p95 above 1000 ms for authenticated routes
- cache hit rate below 70% on public listing pages after warmup
- queue oldest job age above 5 minutes for publish/update actions
- process RSS above 80% of container limit

## Rollout Order

1. Apply public listing indexes and confirm `npm run perf:query-plans` passes.
2. Add shared cache interface and Redis implementation.
3. Put public dealer pages behind CDN caching with purge hooks.
4. Materialize dealer facets and switch public filter UI to the facet table.
5. Move expensive jobs to a shared queue.
6. Migrate database to Postgres when concurrent public reads and background writes outgrow SQLite.
7. Add read replicas and route public read traffic to replicas.

## Open Decisions

- Hosting target: single VPS, Vercel, container platform, or dedicated VM cluster.
- Shared cache provider: Redis/Upstash, platform KV, or self-hosted Redis.
- Queue provider: Redis-backed, Postgres-backed, managed platform queue, or external worker service.
- Database target: managed Postgres provider and migration window.
- CDN purge mechanism: tag-based purge, path purge, or short TTL only.

Track the database migration in `docs/todo-postgres-migration.md`.
