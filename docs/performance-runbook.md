# Performance Runbook

This app now has local guards for hot query plans, load checks, image cache headers, bounded stream logs, and lazy-loaded heavy client widgets. The remaining high-scale work needs deployment choices, so keep it explicit instead of hiding it in code comments.

## Before Release

1. Apply database migrations, including `drizzle/0039_add_public_listing_indexes.sql`.
2. Run `npm run perf:query-plans`.
3. Start the app and run a representative page load check:
   `LOAD_TEST_PATH=/d/example-dealer npm run perf:load`
4. Audit at least one listing image route:
   `IMAGE_AUDIT_URL=http://localhost:3000/api/images/example.webp npm run perf:image-cache`

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

## Database Scale

SQLite with WAL is fast for this app's current single-node shape, but it is not the right long-term database for heavy concurrent public traffic and background writes.

Migration target:

- Postgres with pooled connections
- read replica for public listing and dealer pages
- online index creation for large tables
- query-plan monitoring in CI and production

Keep cursor pagination for public and listing pages. Avoid exact counts on hot paths unless they are cached or materialized.

## Edge/Page Caching

Public dealer pages are cache-friendly because they change mainly after scrape/import/update jobs.

Recommended production shape:

- CDN cache public dealer listing pages with a short stale-while-revalidate window
- purge by dealer slug after sync jobs
- keep authenticated app routes private and uncached
- serve immutable listing images with long-lived cache headers

## Materialized Facets

Filter facets such as makes, fuels, years, categories, and price ranges should eventually be maintained during import/sync instead of recomputed from `listings`.

Recommended table shape:

- `dealer_listing_facets(dealer_id, facet_type, facet_value, listing_count, updated_at)`
- update in the same transaction as listing mutations where possible
- fall back to rebuild jobs after large imports

## Observability

Track these metrics before calling a performance pass complete:

- p95/p99 route latency for public dealer pages, listing search, image routes, and sync APIs
- slow query logs by `timedQuery` label
- cache hit/miss rate
- image route status and cache-control header coverage
- process memory during long streaming jobs
- poster generation 429 rate from the concurrency gate
