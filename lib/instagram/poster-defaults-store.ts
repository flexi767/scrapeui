import { raw } from "@/db/client";
import {
  DEFAULT_POSTER_VARIANT_PROMPTS,
  parsePosterVariantPrompts,
  type PosterVariantPrompt,
} from "@/lib/instagram/poster-variants";

export interface InstagramPosterDefaults {
  promptTemplate: string;
  variantPrompts: PosterVariantPrompt[];
}

interface InstagramPosterDefaultsRow {
  prompt_template: string | null;
  variant_prompts_json: string | null;
}

function ensureInstagramPosterDefaultsTable() {
  raw
    .prepare(
      `CREATE TABLE IF NOT EXISTS instagram_poster_defaults (
        scope_key TEXT PRIMARY KEY,
        prompt_template TEXT NOT NULL,
        variant_prompts_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();
}

export function getInstagramPosterDefaults(scopeKey: string): InstagramPosterDefaults | null {
  ensureInstagramPosterDefaultsTable();
  const row = raw
    .prepare(
      `SELECT prompt_template, variant_prompts_json
       FROM instagram_poster_defaults
       WHERE scope_key = ?`,
    )
    .get(scopeKey) as InstagramPosterDefaultsRow | undefined;
  if (!row) return null;

  let variantPrompts = DEFAULT_POSTER_VARIANT_PROMPTS;
  try {
    variantPrompts = parsePosterVariantPrompts(JSON.parse(row.variant_prompts_json || "[]"));
  } catch {
    variantPrompts = DEFAULT_POSTER_VARIANT_PROMPTS;
  }

  return {
    promptTemplate: row.prompt_template || "",
    variantPrompts,
  };
}

export function saveInstagramPosterDefaults(scopeKey: string, defaults: InstagramPosterDefaults) {
  ensureInstagramPosterDefaultsTable();
  const now = new Date().toISOString();
  raw
    .prepare(
      `INSERT INTO instagram_poster_defaults (
        scope_key,
        prompt_template,
        variant_prompts_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(scope_key) DO UPDATE SET
        prompt_template = excluded.prompt_template,
        variant_prompts_json = excluded.variant_prompts_json,
        updated_at = excluded.updated_at`,
    )
    .run(scopeKey, defaults.promptTemplate, JSON.stringify(defaults.variantPrompts), now, now);
}

export function getInstagramPosterDefaultsScope(dealerId?: number | null) {
  return dealerId ? `dealer:${dealerId}` : "global";
}
