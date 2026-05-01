export interface ScrapeLogEntry {
  type: 'listing' | 'done' | 'error' | 'log' | 'seeded' | 'complete' | 'change';
  level?: 'stderr' | 'info';
  dealer?: string;
  make?: string;
  model?: string;
  title?: string;
  price?: number | null;
  url?: string;
  thumb?: string;
  imageCount?: number;
  views?: number | null;
  mobilePrice?: number | null;
  uniqueMatch?: boolean;
  syncNeeded?: boolean;
  count?: number;
  message?: string;
  code?: number | null;
  mobileId?: string;
  newListing?: boolean;
  priceChanged?: boolean;
  oldPrice?: number | null;
  newPrice?: number | null;
  vatChanged?: boolean;
  oldVat?: string | null;
  newVat?: string | null;
  viewsChanged?: boolean;
  oldViews?: number | null;
  newViews?: number | null;
  adStatusChanged?: boolean;
  oldStatus?: string | null;
  newStatus?: string | null;
  kaparoChanged?: boolean;
  titleChanged?: boolean;
  descriptionChanged?: boolean;
}

export interface ScrapeDealer {
  id: number;
  slug: string;
  name: string;
  mobile_url: string | null;
  cars_url: string | null;
  own: number;
  active: number;
}
