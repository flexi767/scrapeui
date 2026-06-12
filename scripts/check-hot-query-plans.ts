import { raw } from "@/db/client";

interface PlanCase {
  name: string;
  sql: string;
  params: unknown[];
  expectedIndex: string;
}

function firstDealerId(): number | null {
  const row = raw
    .prepare("SELECT id FROM dealers WHERE active = 1 ORDER BY id LIMIT 1")
    .get() as { id: number } | undefined;
  return row?.id ?? null;
}

function explain(sql: string, params: unknown[]) {
  return raw
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...params) as Array<{ detail: string }>;
}

const dealerId = firstDealerId();
if (!dealerId) {
  console.log("No active dealer found; skipping hot query plan checks.");
  process.exit(0);
}

const cases: PlanCase[] = [
  {
    name: "public listings newest",
    expectedIndex: "listings_public_dealer_last_edit_idx",
    sql: `
      SELECT l.id
      FROM listings l
      WHERE l.dealer_id = ? AND l.is_active = 1 AND (l.duplicate = 0 OR l.duplicate IS NULL)
      ORDER BY l.last_edit DESC, l.id DESC
      LIMIT 25
    `,
    params: [dealerId],
  },
  {
    name: "public listings price",
    expectedIndex: "listings_public_dealer_price_idx",
    sql: `
      SELECT l.id
      FROM listings l
      WHERE l.dealer_id = ? AND l.is_active = 1 AND (l.duplicate = 0 OR l.duplicate IS NULL)
      ORDER BY l.current_price ASC, l.id ASC
      LIMIT 25
    `,
    params: [dealerId],
  },
  {
    name: "public listing makes",
    expectedIndex: "listings_public_dealer_make_idx",
    sql: `
      SELECT DISTINCT make
      FROM listings
      WHERE dealer_id = ? AND is_active = 1 AND make IS NOT NULL
      ORDER BY make
    `,
    params: [dealerId],
  },
];

const failures: string[] = [];
for (const planCase of cases) {
  const details = explain(planCase.sql, planCase.params).map((row) => row.detail);
  const usedExpectedIndex = details.some((detail) => detail.includes(planCase.expectedIndex));
  console.log(`\n${planCase.name}`);
  for (const detail of details) console.log(`  ${detail}`);
  if (!usedExpectedIndex) {
    failures.push(`${planCase.name} did not use ${planCase.expectedIndex}`);
  }
}

if (failures.length > 0) {
  console.error(`\nHot query plan check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("\nHot query plan check passed.");
