import type Database from "better-sqlite3";

type DbValue = string | number | null;

export function parseIntParam(rawValue: string): number | null {
  const id = Number.parseInt(rawValue, 10);
  return Number.isFinite(id) ? id : null;
}

export function collectMappedUpdates(
  body: Record<string, unknown>,
  fieldMap: Record<string, string>,
): { assignments: string[]; values: DbValue[] } {
  const assignments: string[] = [];
  const values: DbValue[] = [];

  for (const [bodyKey, dbColumn] of Object.entries(fieldMap)) {
    if (bodyKey in body) {
      assignments.push(`${dbColumn} = ?`);
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
      assignments.push(`${column} = ?`);
      values.push(value);
    }
  }

  if (assignments.length === 0) return false;

  db.prepare(`UPDATE ${table} SET ${assignments.join(", ")} WHERE ${idColumn} = ?`).run(
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
  const insert = db.prepare(`INSERT INTO ${table} (${ownerColumn}, ${relatedColumn}) VALUES (?, ?)`);
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

  db.prepare(`DELETE FROM ${table} WHERE ${ownerColumn} = ?`).run(ownerId);
  const insert = db.prepare(
    `INSERT INTO ${table} (${ownerColumn}, ${relatedColumn}) VALUES (?, ?)`,
  );
  for (const relatedId of relatedIds) {
    insert.run(ownerId, relatedId);
  }
}
