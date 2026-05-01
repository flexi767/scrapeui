import type { EditOwnSyncRow } from '@/lib/queries';
import { formatPrice } from '@/lib/utils';
import type { BatchRow, RunStats, StreamEntry } from './types';

function formatVatLabel(value: string | null) {
  if (value === 'included') return 'има';
  if (value === 'exempt') return 'няма';
  if (value === 'excluded') return '+ДДС';
  return '—';
}

export function buildChangeRows(row: EditOwnSyncRow) {
  const changes: Array<{ label: string; oldValue: string; newValue: string }> = [];

  if ((row.source_title ?? '') !== (row.title ?? '')) {
    changes.push({
      label: 'Title',
      oldValue: row.source_title || '—',
      newValue: row.title || '—',
    });
  }

  if ((row.source_price ?? null) !== (row.current_price ?? null)) {
    changes.push({
      label: 'Price',
      oldValue: row.source_price != null ? formatPrice(row.source_price) : '—',
      newValue: row.current_price != null ? formatPrice(row.current_price) : '—',
    });
  }

  if ((row.source_vat ?? null) !== (row.vat ?? null)) {
    changes.push({
      label: 'VAT',
      oldValue: formatVatLabel(row.source_vat),
      newValue: formatVatLabel(row.vat),
    });
  }

  if ((row.source_ad_status ?? 'none') !== (row.ad_status ?? 'none')) {
    changes.push({
      label: 'Paid',
      oldValue: row.source_ad_status || 'none',
      newValue: row.ad_status || 'none',
    });
  }

  if ((row.source_kaparo ?? 0) !== (row.kaparo ?? 0)) {
    changes.push({
      label: 'К',
      oldValue: row.source_kaparo === 1 ? 'К' : '—',
      newValue: row.kaparo === 1 ? 'К' : '—',
    });
  }

  return changes;
}

export function toBatchRow(row: EditOwnSyncRow): BatchRow {
  return {
    ...row,
    runStatus: row.last_mobile_sync_status ?? (row.needs_sync === 1 ? 'pending' : null),
    runError: row.last_mobile_sync_error,
    completedAt: row.last_mobile_sync_at,
  };
}

export function labelForRow(row: {
  make: string | null;
  model: string | null;
  title: string | null;
  mobile_id: string | null;
  backup_id: number;
}) {
  return [row.make, row.model, row.title].filter(Boolean).join(' ') || row.mobile_id || `backup ${row.backup_id}`;
}

export function isEditOwnSyncRow(data: EditOwnSyncRow | { error?: string } | null): data is EditOwnSyncRow {
  return Boolean(data && typeof data === 'object' && 'backup_id' in data);
}

export function statsFromStreamEvent(event: Extract<StreamEntry, { total: number }>): RunStats {
  return {
    total: event.total,
    completed: event.completed,
    succeeded: event.succeeded,
    failed: event.failed,
  };
}

export function streamEventMessageKind(event: StreamEntry) {
  if (event.type === 'error') return 'error';
  if (event.type === 'log') return event.level === 'stderr' ? 'error' : 'log';
  if (event.type === 'result') return 'result';
  return 'status';
}

export function countBatchRows(rows: BatchRow[]) {
  return {
    pending: rows.filter((row) => row.needs_sync === 1).length,
    success: rows.filter((row) => row.runStatus === 'success').length,
    failed: rows.filter((row) => row.runStatus === 'failed').length,
  };
}

export function recentCompletedRows(rows: BatchRow[], limit = 12) {
  return rows
    .filter((row) => row.runStatus === 'success' || row.runStatus === 'failed')
    .slice()
    .reverse()
    .slice(0, limit);
}

export function prepareRowsForRun(rows: BatchRow[]) {
  return rows.map((row) => row.needs_sync === 1 ? {
    ...row,
    runStatus: 'pending',
    runError: null,
    completedAt: row.completedAt,
  } : row);
}

export function markRowRunning(rows: BatchRow[], backupId: number) {
  return rows.map((row) => row.backup_id === backupId ? {
    ...row,
    runStatus: 'running',
    runError: null,
  } : row);
}

export function applyRowResult(rows: BatchRow[], result: Extract<StreamEntry, { type: 'result' }>['row']) {
  return rows.map((row) => row.backup_id === result.backup_id ? {
    ...row,
    needs_sync: result.status === 'success' ? 0 : row.needs_sync,
    runStatus: result.status,
    runError: result.error,
    completedAt: result.completed_at,
  } : row);
}
