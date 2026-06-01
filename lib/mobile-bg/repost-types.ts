export interface BackupRow {
  id: number;
  dealer_id?: number | null;
  listing_id?: number | null;
  mobile_id: string | null;
  source_url: string | null;
  title: string | null;
  source_title: string | null;
  price_amount: number | null;
  vat_included: string | null;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  power: number | null;
  engine: string | null;
  color: string | null;
  transmission: string | null;
  category: string | null;
  description: string | null;
  make: string | null;
  model: string | null;
  extras_json: string | null;
  tech_data_json: string | null;
}

export interface EditSnapshotRow {
  id: number;
  listing_token: string | null;
  fields_json: string | null;
  checked_boxes_json: string | null;
}

export interface BackupImageRow {
  local_path: string;
}
