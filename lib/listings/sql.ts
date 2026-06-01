import type Database from 'better-sqlite3';

/**
 * Column → value map for data-driven INSERT/UPDATE builders.
 *
 * Each key is a SQL column name; the value is bound as a positional parameter.
 * Use `null` to write SQL NULL. Keys whose value is `undefined` are skipped
 * entirely — this is how callers express "only update this column when the
 * field is present" without hand-maintaining parallel column/value arrays.
 */
export type ColumnValues = Record<string, unknown>;
export type RawSetAssignment = string | { sql: string; params: unknown[] };

function definedEntries(values: ColumnValues): [string, unknown][] {
  return Object.entries(values).filter(([, value]) => value !== undefined);
}

/**
 * Build and run an INSERT from a column→value map.
 *
 * Pairs every column with its placeholder automatically, eliminating the
 * silent-corruption risk of hand-aligned `VALUES (?, ?, …)` lists. Literal
 * values (e.g. `is_active: 1`, `source: 'c'`, `deleted_at: null`) go straight
 * into the map.
 */
export function runInsert(
  db: Database.Database,
  table: string,
  values: ColumnValues,
): Database.RunResult {
  const entries = definedEntries(values);
  const columns = entries.map(([column]) => column);
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  return db.prepare(sql).run(...entries.map(([, value]) => value));
}

/**
 * Build and run an UPDATE from a column→value map.
 *
 * Columns with `undefined` values are omitted from the SET clause. Raw SQL
 * assignments that take no parameter (e.g. `is_active = 1`, `deleted_at = NULL`)
 * are appended via `rawSet`. The WHERE clause and its params are supplied by the
 * caller.
 */
export function runUpdate(
  db: Database.Database,
  table: string,
  set: ColumnValues,
  where: { sql: string; params: unknown[] },
  rawSet: RawSetAssignment[] = [],
): Database.RunResult {
  const entries = definedEntries(set);
  const rawAssignments = rawSet.map((assignment) =>
    typeof assignment === 'string' ? assignment : assignment.sql,
  );
  const rawParams = rawSet.flatMap((assignment) =>
    typeof assignment === 'string' ? [] : assignment.params,
  );
  const assignments = [
    ...entries.map(([column]) => `${column} = ?`),
    ...rawAssignments,
  ];
  const sql = `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${where.sql}`;
  return db
    .prepare(sql)
    .run(...entries.map(([, value]) => value), ...rawParams, ...where.params);
}
