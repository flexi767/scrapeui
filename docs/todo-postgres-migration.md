# TODO: Postgres Migration

SQLite remains the main ceiling for concurrent public traffic plus background write jobs. Keep this migration as an explicit backlog item until the hosting/database target is chosen.

## Decisions

- [ ] Choose managed Postgres provider.
- [ ] Choose connection pooler strategy.
- [ ] Decide whether public reads move first or background writes move first.
- [ ] Decide read replica provider and routing approach.

## Implementation

- [ ] Inventory all `raw.prepare` SQL by module.
- [ ] Add a database adapter boundary for hot read modules.
- [ ] Convert SQLite migrations to Postgres-compatible migrations.
- [ ] Replace SQLite FTS with Postgres `tsvector`/GIN search.
- [ ] Add Postgres equivalents for public listing indexes.
- [ ] Add data backfill script from SQLite to Postgres.
- [ ] Add dual-read validation for public listing list/detail queries.
- [ ] Add write-path validation for scrape/import/update jobs.
- [ ] Add read-replica routing for public dealer pages.

## Validation

- [ ] Public listing query plans use expected Postgres indexes.
- [ ] Public listing p95 remains below target under load.
- [ ] Background scrape/import jobs do not block public reads.
- [ ] Rollback path is documented and tested in staging.
