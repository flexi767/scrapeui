export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36';

export interface MobileBgDealerRow {
  id: number;
  slug: string;
  name: string;
  mobile_user: string | null;
  mobile_password: string | null;
}

export interface DealerBackupConfig {
  id: number;
  slug: string;
  name?: string;
  mobileUrl?: string;
  mobileUser: string;
  mobilePassword: string;
}
