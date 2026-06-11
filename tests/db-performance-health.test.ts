import { describe, expect, it } from 'vitest';
import {
  formatDbPerformanceHealthIssues,
  inspectDbPerformanceHealth,
} from '@/lib/db-performance-health';

function fakeDb(names: Record<'table' | 'index' | 'trigger', string[]>) {
  return {
    prepare() {
      return {
        all(type: 'table' | 'index' | 'trigger') {
          return names[type].map((name) => ({ name }));
        },
      };
    },
  };
}

const required = {
  table: [
    'listings_search_fts',
    'listing_change_search_fts',
    'tasks_search_fts',
    'expenses_search_fts',
    'articles_search_fts',
    'listing_extras',
    'mobilebg_backup_extras',
  ],
  index: [
    'listing_extras_unique_idx',
    'listing_extras_label_listing_idx',
    'mobilebg_backup_extras_unique_idx',
    'mobilebg_backup_extras_label_backup_idx',
    'listings_active_price_idx',
    'listings_active_last_edit_idx',
    'listings_active_dealer_idx',
    'listings_active_make_model_idx',
    'listings_active_filter_facets_idx',
  ],
  trigger: [
    'listings_search_fts_after_insert',
    'listings_search_fts_after_delete',
    'listings_search_fts_after_update',
    'listing_change_search_fts_after_insert',
    'listing_change_search_fts_after_delete',
    'listing_change_search_fts_after_update',
    'tasks_search_fts_after_insert',
    'tasks_search_fts_after_delete',
    'tasks_search_fts_after_update',
    'expenses_search_fts_after_insert',
    'expenses_search_fts_after_delete',
    'expenses_search_fts_after_update',
    'articles_search_fts_after_insert',
    'articles_search_fts_after_delete',
    'articles_search_fts_after_update',
    'listing_extras_after_insert',
    'listing_extras_after_update',
    'listing_extras_after_delete',
    'mobilebg_backup_extras_after_insert',
    'mobilebg_backup_extras_after_update',
    'mobilebg_backup_extras_after_delete',
  ],
};

describe('inspectDbPerformanceHealth', () => {
  it('passes when all required performance objects exist', () => {
    expect(inspectDbPerformanceHealth(fakeDb(required))).toEqual({
      missingTables: [],
      missingIndexes: [],
      missingTriggers: [],
    });
  });

  it('reports missing tables, indexes, and triggers', () => {
    const report = inspectDbPerformanceHealth(fakeDb({
      table: required.table.filter((name) => name !== 'listing_extras'),
      index: required.index.filter((name) => name !== 'listing_extras_label_listing_idx'),
      trigger: required.trigger.filter((name) => name !== 'listing_extras_after_update'),
    }));

    expect(report).toEqual({
      missingTables: ['listing_extras'],
      missingIndexes: ['listing_extras_label_listing_idx'],
      missingTriggers: ['listing_extras_after_update'],
    });
    expect(formatDbPerformanceHealthIssues(report)).toEqual([
      'missing tables: listing_extras',
      'missing indexes: listing_extras_label_listing_idx',
      'missing triggers: listing_extras_after_update',
    ]);
  });
});
