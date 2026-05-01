export type RankLogLevel = 'stderr' | 'info';

export interface RankStats {
  total: number;
  checked: number;
  found: number;
  notFound: number;
}

export interface RankTarget {
  backup_id: number;
  listing_id: number;
  mobile_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  thumb_url: string | null;
  listing_url: string | null;
}

export interface RankRow {
  backup_id: number;
  listing_id: number;
  mobile_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  checked_at: string;
  original_position: number | null;
  price_position: number | null;
  first_result_price: number | null;
  found: boolean;
  thumb_url: string | null;
  listing_url: string | null;
}

export type SearchPositionStreamEntry =
  | {
      type: 'start';
      stats: RankStats;
      missingOnly: boolean;
      message?: string;
    }
  | {
      type: 'checking';
      stats: RankStats;
      target: RankTarget;
      message?: string;
    }
  | {
      type: 'result';
      stats: RankStats;
      row: RankRow;
      message?: string;
    }
  | {
      type: 'complete';
      total: number;
      found: number;
      notFound: number;
      rows: RankRow[];
      message?: string;
      code?: number | null;
    }
  | {
      type: 'log';
      level?: RankLogLevel;
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

export interface SearchPositionLogEntry {
  kind: 'status' | 'result' | 'log' | 'error';
  message: string;
  found?: boolean;
  thumbUrl?: string | null;
  listingUrl?: string | null;
  originalPosition?: number | null;
  pricePosition?: number | null;
}

export interface SearchPositionSummary {
  total: number;
  found: number;
  notFound: number;
}

export interface SearchPositionPreview {
  thumbUrl: string | null;
  listingUrl: string | null;
}
