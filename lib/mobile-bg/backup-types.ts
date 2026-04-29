import type { VatValue } from "@/lib/vat";

export interface DealerBackupConfig {
  id: number;
  slug: string;
  name: string;
  own?: boolean;
  mobileUrl: string;
  mobileUser: string;
  mobilePassword: string;
}

export interface ScrapedDetail {
  mobileId: string;
  url: string;
  sourceTitle: string;
  make: string;
  model: string;
  title: string;
  priceAmount: number | null;
  priceCurrency: string;
  vat: VatValue | null;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  power: number | null;
  engine: string | null;
  color: string | null;
  transmission: string | null;
  category: string | null;
  description: string;
  phones: string[];
  extras: Record<string, Array<{ label: string; alias: string | null }>>;
  techData: Record<string, string>;
  photoOrder: string[];
  photoThumbUrls: string[];
  imageUrls: string[];
}

export interface ScrapedListingPageData {
  title: string;
  price: string | null;
  noVat: boolean;
  hasVat: boolean;
  year: string | null;
  fuel: string | null;
  power: string | null;
  engine: string | null;
  transmission: string | null;
  category: string | null;
  mileage: string | null;
  color: string | null;
  description: string;
  listingId: string | null;
  phones: string[];
  extras: Record<string, Array<{ label: string; alias: string | null }>>;
  techData: Record<string, string>;
  photoOrder: string[];
  photoThumbUrls: string[];
}

export interface SavedImage {
  filename: string;
  url: string;
  localPath: string;
}

export interface DealerDraftDefaults {
  region: string;
  city: string;
  phone: string;
  email: string;
  website: string;
}

export interface ExistingBackupRow {
  id: number;
}

export interface DealerDraftRow {
  id: number;
  slug: string;
  name: string;
  own: number | null;
  active: number | null;
}

export interface SnapshotFieldsRow {
  fields_json: string | null;
}

export interface BackupDefaultsRow {
  tech_data_json: string | null;
  phones_json: string | null;
}

export interface BackupDealerResult {
  runId: number;
  listingsCount: number;
  imagesCount: number;
}

export interface BackupProgressEvent {
  type: "status" | "listing" | "complete";
  dealer?: string;
  runId?: number;
  message?: string;
  current?: number;
  total?: number;
  action?: "created" | "updated";
  mobileId?: string;
  make?: string;
  model?: string;
  title?: string;
  url?: string;
  previewUrl?: string;
  imageCount?: number;
  views?: number | null;
  watching?: number | null;
  adStatus?: "TOP" | "VIP" | "none";
  listingsCount?: number;
  imagesCount?: number;
}
