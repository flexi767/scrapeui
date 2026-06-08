import { raw } from '@/db/client';
import type { LabelRow, ListingSummary } from './core';

type RelationEntity = 'article' | 'expense' | 'task';

interface RelationConfig {
  listingsTable: string;
  labelsTable: string;
  entityColumn: string;
}

export interface UploadSummary {
  id: number;
  filename: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  entity_type: string | null;
  entity_id: number | null;
  uploaded_by_id: number | null;
  created_at: string;
}

const RELATIONS: Record<RelationEntity, RelationConfig> = {
  article: {
    listingsTable: 'article_listings',
    labelsTable: 'article_labels',
    entityColumn: 'article_id',
  },
  expense: {
    listingsTable: 'expense_listings',
    labelsTable: 'expense_labels',
    entityColumn: 'expense_id',
  },
  task: {
    listingsTable: 'task_listings',
    labelsTable: 'task_labels',
    entityColumn: 'task_id',
  },
};

export function getRelatedListingSummaries(entity: RelationEntity, entityId: number): ListingSummary[] {
  const config = RELATIONS[entity];

  return raw
    .prepare(
      `
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price, l.vat
    FROM ${config.listingsTable} rel
    JOIN listings l ON l.id = rel.listing_id
    WHERE rel.${config.entityColumn} = ?
  `,
    )
    .all(entityId) as ListingSummary[];
}

export function getRelatedLabels(entity: RelationEntity, entityId: number): LabelRow[] {
  const config = RELATIONS[entity];

  return raw
    .prepare(
      `
    SELECT lb.id, lb.name, lb.color
    FROM ${config.labelsTable} rel
    JOIN labels lb ON lb.id = rel.label_id
    WHERE rel.${config.entityColumn} = ?
  `,
    )
    .all(entityId) as LabelRow[];
}

export function getRelatedUploads(entity: 'article' | 'expense', entityId: number): UploadSummary[] {
  return raw
    .prepare(
      `
    SELECT id, filename, stored_name, mime_type, size_bytes, entity_type, entity_id, uploaded_by_id, created_at
    FROM uploads
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `,
    )
    .all(entity, entityId) as UploadSummary[];
}
