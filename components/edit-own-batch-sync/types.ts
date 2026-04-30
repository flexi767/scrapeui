import type { EditOwnSyncRow } from '@/lib/queries';

export interface OwnDealer {
  slug: string;
  name: string;
}

export type BatchRow = EditOwnSyncRow & {
  runStatus: string | null;
  runError: string | null;
  completedAt: string | null;
};

export type StreamEntry =
  | {
      type: 'start';
      total: number;
      completed: number;
      succeeded: number;
      failed: number;
      message?: string;
    }
  | {
      type: 'checking';
      total: number;
      completed: number;
      succeeded: number;
      failed: number;
      target: {
        backup_id: number;
        mobile_id: string | null;
        title: string | null;
        make: string | null;
        model: string | null;
        dealer_name: string | null;
        dealer_slug: string;
      };
      message?: string;
    }
  | {
      type: 'result';
      total: number;
      completed: number;
      succeeded: number;
      failed: number;
      row: {
        backup_id: number;
        mobile_id: string | null;
        status: 'success' | 'failed';
        completed_at: string;
        error: string | null;
      };
      message?: string;
    }
  | {
      type: 'complete';
      total: number;
      completed: number;
      succeeded: number;
      failed: number;
      message?: string;
    }
  | {
      type: 'log';
      level?: 'info' | 'stderr';
      backup_id?: number;
      message?: string;
    }
  | {
      type: 'error';
      message?: string;
    }
  | {
      type: 'stream_closed';
      code?: number | null;
    };

export interface RunStats {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
}

export interface LogEntry {
  kind: 'status' | 'result' | 'log' | 'error';
  message: string;
  ok?: boolean;
}
