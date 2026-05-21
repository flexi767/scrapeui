import { raw } from "@/db/client";
import { currentIsoTimestamp } from "@/lib/date-format";

export interface DealerTemplateConfig {
  id: number;
  dealerId: number | null;
  baseTemplateId: number | null;
  name: string;
  configJson: string;
  createdAt: string;
  updatedAt: string;
}

export function listDealerTemplateConfigs(dealerId: number): DealerTemplateConfig[] {
  return raw
    .prepare(
      `SELECT id, dealer_id as dealerId, base_template_id as baseTemplateId,
              name, config_json as configJson, created_at as createdAt, updated_at as updatedAt
       FROM dealer_template_configs
       WHERE dealer_id = ? OR dealer_id IS NULL
       ORDER BY dealer_id IS NULL DESC, created_at ASC`,
    )
    .all(dealerId) as DealerTemplateConfig[];
}

export function listAllDealerTemplateConfigs(): DealerTemplateConfig[] {
  return raw
    .prepare(
      `SELECT id, dealer_id as dealerId, base_template_id as baseTemplateId,
              name, config_json as configJson, created_at as createdAt, updated_at as updatedAt
       FROM dealer_template_configs
       ORDER BY dealer_id IS NULL DESC, dealer_id ASC, created_at ASC`,
    )
    .all() as DealerTemplateConfig[];
}

export function getDealerTemplateConfig(id: number): DealerTemplateConfig | null {
  const row = raw
    .prepare(
      `SELECT id, dealer_id as dealerId, base_template_id as baseTemplateId,
              name, config_json as configJson, created_at as createdAt, updated_at as updatedAt
       FROM dealer_template_configs WHERE id = ?`,
    )
    .get(id) as DealerTemplateConfig | undefined;
  return row ?? null;
}

export function getActiveDealerTemplateConfig(dealerId: number): DealerTemplateConfig | null {
  const row = raw
    .prepare(
      `SELECT dtc.id, dtc.dealer_id as dealerId, dtc.base_template_id as baseTemplateId,
              dtc.name, dtc.config_json as configJson,
              dtc.created_at as createdAt, dtc.updated_at as updatedAt
       FROM dealer_template_configs dtc
       JOIN dealers d ON d.active_template_config_id = dtc.id
       WHERE d.id = ?
       LIMIT 1`,
    )
    .get(dealerId) as DealerTemplateConfig | undefined;
  return row ?? null;
}

export function createDealerTemplateConfig(params: {
  dealerId: number;
  baseTemplateId: number | null;
  name: string;
  configJson: string;
}): number {
  const now = currentIsoTimestamp();
  const result = raw
    .prepare(
      `INSERT INTO dealer_template_configs (dealer_id, base_template_id, name, config_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(params.dealerId, params.baseTemplateId, params.name, params.configJson, now, now);
  return result.lastInsertRowid as number;
}

export function updateDealerTemplateConfig(
  id: number,
  fields: { name?: string; configJson?: string },
): void {
  const now = currentIsoTimestamp();
  if (fields.name !== undefined && fields.configJson !== undefined) {
    raw
      .prepare(
        `UPDATE dealer_template_configs SET name = ?, config_json = ?, updated_at = ? WHERE id = ?`,
      )
      .run(fields.name, fields.configJson, now, id);
  } else if (fields.name !== undefined) {
    raw
      .prepare(`UPDATE dealer_template_configs SET name = ?, updated_at = ? WHERE id = ?`)
      .run(fields.name, now, id);
  } else if (fields.configJson !== undefined) {
    raw
      .prepare(`UPDATE dealer_template_configs SET config_json = ?, updated_at = ? WHERE id = ?`)
      .run(fields.configJson, now, id);
  }
}

export function forkDealerTemplateConfig(sourceId: number, newName: string, targetDealerId: number): number {
  const source = getDealerTemplateConfig(sourceId);
  if (!source) throw new Error(`Config ${sourceId} not found`);
  return createDealerTemplateConfig({
    dealerId: targetDealerId,
    baseTemplateId: sourceId,
    name: newName,
    configJson: source.configJson,
  });
}

export function activateDealerTemplateConfig(configId: number, dealerId: number): void {
  raw
    .prepare(`UPDATE dealers SET active_template_config_id = ? WHERE id = ?`)
    .run(configId, dealerId);
}

export function deleteDealerTemplateConfig(id: number): void {
  const inUse = raw
    .prepare(`SELECT id FROM dealers WHERE active_template_config_id = ? LIMIT 1`)
    .get(id);
  if (inUse) throw new Error("Cannot delete an active template config");
  raw.prepare(`DELETE FROM dealer_template_configs WHERE id = ?`).run(id);
}
