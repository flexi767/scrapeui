import type Database from "better-sqlite3";

type DbValue = string | number | null;

const ALLOWED_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
export function ident(name: string): string {
  if (!ALLOWED_IDENTIFIER.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return name;
}

export function parseIntParam(rawValue: string): number | null {
  const id = Number.parseInt(rawValue, 10);
  return Number.isFinite(id) ? id : null;
}

export function parsePositiveIntParam(rawValue: string): number | null {
  const id = Number(rawValue);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function collectMappedUpdates(
  body: Record<string, unknown>,
  fieldMap: Record<string, string>,
): { assignments: string[]; values: DbValue[] } {
  const assignments: string[] = [];
  const values: DbValue[] = [];

  for (const [bodyKey, dbColumn] of Object.entries(fieldMap)) {
    if (bodyKey in body) {
      assignments.push(`${ident(dbColumn)} = ?`);
      values.push((body[bodyKey] ?? null) as DbValue);
    }
  }

  return { assignments, values };
}

export function runMappedUpdate(
  db: Database.Database,
  table: string,
  idColumn: string,
  id: number,
  body: Record<string, unknown>,
  fieldMap: Record<string, string>,
  extraAssignments: Record<string, DbValue> = {},
): boolean {
  const { assignments, values } = collectMappedUpdates(body, fieldMap);

  for (const [column, value] of Object.entries(extraAssignments)) {
    if (assignments.length > 0) {
      assignments.push(`${ident(column)} = ?`);
      values.push(value);
    }
  }

  if (assignments.length === 0) return false;

  db.prepare(`UPDATE ${ident(table)} SET ${assignments.join(", ")} WHERE ${ident(idColumn)} = ?`).run(
    ...values,
    id,
  );
  return true;
}

export function insertJoinRows(
  db: Database.Database,
  table: string,
  ownerColumn: string,
  relatedColumn: string,
  ownerId: number,
  relatedIds: unknown,
) {
  if (!Array.isArray(relatedIds) || relatedIds.length === 0) return;
  const insert = db.prepare(`INSERT INTO ${ident(table)} (${ident(ownerColumn)}, ${ident(relatedColumn)}) VALUES (?, ?)`);
  for (const relatedId of relatedIds) {
    insert.run(ownerId, relatedId);
  }
}

export function logActivity(
  db: Database.Database,
  entityType: string,
  entityId: number,
  action: string,
  detail: string | null,
  userId: number,
  createdAt: string,
) {
  db.prepare(`
    INSERT INTO activity_log (entity_type, entity_id, action, detail, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entityType, entityId, action, detail, userId, createdAt);
}

export function replaceJoinRows(
  db: Database.Database,
  table: string,
  ownerColumn: string,
  relatedColumn: string,
  ownerId: number,
  relatedIds: unknown,
) {
  if (!Array.isArray(relatedIds)) return;

  db.prepare(`DELETE FROM ${ident(table)} WHERE ${ident(ownerColumn)} = ?`).run(ownerId);
  const insert = db.prepare(
    `INSERT INTO ${ident(table)} (${ident(ownerColumn)}, ${ident(relatedColumn)}) VALUES (?, ?)`,
  );
  for (const relatedId of relatedIds) {
    insert.run(ownerId, relatedId);
  }
}

export function copyJoinRows(
  db: Database.Database,
  table: string,
  ownerColumn: string,
  relatedColumn: string,
  fromOwnerId: number,
  toOwnerId: number,
) {
  db.prepare(`
    INSERT INTO ${ident(table)} (${ident(ownerColumn)}, ${ident(relatedColumn)})
    SELECT ?, ${ident(relatedColumn)}
    FROM ${ident(table)}
    WHERE ${ident(ownerColumn)} = ?
  `).run(toOwnerId, fromOwnerId);
}
