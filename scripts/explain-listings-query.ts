import { raw } from "@/db/client";
import { toListingFtsQuery } from "@/lib/query-modules/listings/list-filters";

const search = process.env.SEARCH?.trim() || "bmw";
const allowedSorts = new Set([
  "current_price",
  "last_edit",
  "carsbg_created_date",
  "views",
  "mileage",
  "fuel",
  "ad_status",
  "kaparo",
  "reg_year",
]);
const requestedSort = process.env.SORT || "current_price";
const sort = allowedSorts.has(requestedSort) ? requestedSort : "current_price";
const order = process.env.ORDER?.toUpperCase() === "ASC" ? "ASC" : "DESC";
const ftsQuery = toListingFtsQuery(search);

const rows = raw
  .prepare(
    `
    EXPLAIN QUERY PLAN
    SELECT l.id
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.is_active = 1
      AND d.active = 1
      AND (l.duplicate = 0 OR l.duplicate IS NULL)
      AND EXISTS (
        SELECT 1
        FROM listings_search_fts
        WHERE listings_search_fts.rowid = l.id
          AND listings_search_fts MATCH ?
      )
    ORDER BY l.${sort} ${order}, l.id ${order}
    LIMIT 51
  `,
  )
  .all(ftsQuery) as Array<{ detail: string }>;

console.log(`SEARCH=${search}`);
console.log(`FTS=${ftsQuery}`);
for (const row of rows) console.log(row.detail);
