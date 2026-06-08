import { raw } from "@/db/client";
import { currentIsoTimestamp } from "@/lib/date-format";
import { runInsert, runUpdate } from "@/lib/listings/sql";

export interface DealerTemplateConfig {
  id: number;
  dealerId: number | null;
  baseTemplateId: number | null;
  name: string;
  configJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealerTemplateListRow {
  id: number;
  dealerId: number | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  isActive: number;
}

export interface DealerTemplateDealerOption {
  id: number;
  name: string;
}

export interface DealerTemplateDealerContext {
  slug: string;
  activeTemplateConfigId: number | null;
  firstListingId: string | null;
}

function templateConfigSelect(alias = ''): string {
  const prefix = alias ? `${alias}.` : '';
  return `
  ${prefix}id, ${prefix}dealer_id as dealerId, ${prefix}base_template_id as baseTemplateId,
  ${prefix}name, ${prefix}config_json as configJson, ${prefix}created_at as createdAt, ${prefix}updated_at as updatedAt
`;
}

const TEMPLATE_LIST_SELECT = `
  SELECT dtc.id, dtc.dealer_id as dealerId, dtc.name,
          dtc.created_at as createdAt, dtc.updated_at as updatedAt,
          CASE WHEN d.active_template_config_id = dtc.id THEN 1 ELSE 0 END as isActive
  FROM dealer_template_configs dtc
  LEFT JOIN dealers d ON d.id = dtc.dealer_id
`;

export function listDealerTemplateConfigs(dealerId: number): DealerTemplateConfig[] {
  return raw
    .prepare(
      `SELECT ${templateConfigSelect()}
       FROM dealer_template_configs
       WHERE dealer_id = ? OR dealer_id IS NULL
       ORDER BY dealer_id IS NULL DESC, created_at ASC`,
    )
    .all(dealerId) as DealerTemplateConfig[];
}

export function listAllDealerTemplateConfigs(): DealerTemplateConfig[] {
  return raw
    .prepare(
      `SELECT ${templateConfigSelect()}
       FROM dealer_template_configs
       ORDER BY dealer_id IS NULL DESC, dealer_id ASC, created_at ASC`,
    )
    .all() as DealerTemplateConfig[];
}

export function listDealerTemplateConfigRowsForSession(session: {
  role: string;
  dealerId: number | null;
}): DealerTemplateListRow[] {
  if (session.role === "admin") {
    return raw
      .prepare(
        `${TEMPLATE_LIST_SELECT}
         ORDER BY dtc.dealer_id IS NULL DESC, dtc.dealer_id ASC, dtc.created_at ASC`,
      )
      .all() as DealerTemplateListRow[];
  }

  if (!session.dealerId) return [];
  return raw
    .prepare(
      `${TEMPLATE_LIST_SELECT}
       WHERE dtc.dealer_id = ? OR dtc.dealer_id IS NULL
       ORDER BY dtc.dealer_id IS NULL DESC, dtc.created_at ASC`,
    )
    .all(session.dealerId) as DealerTemplateListRow[];
}

export function listDealerTemplateDealerOptions(): DealerTemplateDealerOption[] {
  return raw
    .prepare(`SELECT id, name FROM dealers ORDER BY active DESC, priority DESC, name ASC`)
    .all() as DealerTemplateDealerOption[];
}

export function getDealerTemplateConfig(id: number): DealerTemplateConfig | null {
  const row = raw
    .prepare(
      `SELECT ${templateConfigSelect()}
       FROM dealer_template_configs WHERE id = ?`,
    )
    .get(id) as DealerTemplateConfig | undefined;
  return row ?? null;
}

export function getActiveDealerTemplateConfig(dealerId: number): DealerTemplateConfig | null {
  const row = raw
    .prepare(
      `SELECT ${templateConfigSelect('dtc')}
       FROM dealer_template_configs dtc
       JOIN dealers d ON d.active_template_config_id = dtc.id
       WHERE d.id = ?
       LIMIT 1`,
    )
    .get(dealerId) as DealerTemplateConfig | undefined;
  return row ?? null;
}

export function getDealerTemplateDealerContext(dealerId: number): DealerTemplateDealerContext | null {
  const dealer = raw
    .prepare(`SELECT slug, active_template_config_id as activeTemplateConfigId FROM dealers WHERE id = ?`)
    .get(dealerId) as { slug: string; activeTemplateConfigId: number | null } | undefined;
  if (!dealer) return null;

  const firstListing = raw
    .prepare(`SELECT mobile_id as firstListingId FROM listings WHERE dealer_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`)
    .get(dealerId) as { firstListingId: string } | undefined;

  return {
    slug: dealer.slug,
    activeTemplateConfigId: dealer.activeTemplateConfigId,
    firstListingId: firstListing?.firstListingId ?? null,
  };
}

export function createDealerTemplateConfig(params: {
  dealerId: number;
  baseTemplateId: number | null;
  name: string;
  configJson: string;
}): number {
  const now = currentIsoTimestamp();
  const result = runInsert(raw, "dealer_template_configs", {
    dealer_id: params.dealerId,
    base_template_id: params.baseTemplateId,
    name: params.name,
    config_json: params.configJson,
    created_at: now,
    updated_at: now,
  });
  return result.lastInsertRowid as number;
}

export function updateDealerTemplateConfig(
  id: number,
  fields: { name?: string; configJson?: string },
): void {
  if (fields.name === undefined && fields.configJson === undefined) return;

  const now = currentIsoTimestamp();
  runUpdate(
    raw,
    "dealer_template_configs",
    {
      name: fields.name,
      config_json: fields.configJson,
      updated_at: now,
    },
    { sql: "id = ?", params: [id] },
  );
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
