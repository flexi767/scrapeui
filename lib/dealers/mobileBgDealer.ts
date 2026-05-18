import type { DealerBackupConfig } from '@/lib/mobile-bg/constants';

export interface MobileBgDealerSource {
  id: number;
  slug: string;
  name?: string | null;
  mobile_url?: string | null;
  mobile_user?: string | null;
  mobile_password?: string | null;
}

export function getMobileBgDealerConfig(
  dealer: MobileBgDealerSource | null | undefined,
): DealerBackupConfig | null {
  if (!dealer?.mobile_user || !dealer.mobile_password) return null;

  return {
    id: dealer.id,
    slug: dealer.slug,
    name: dealer.name ?? undefined,
    mobileUrl: dealer.mobile_url ?? '',
    mobileUser: dealer.mobile_user,
    mobilePassword: dealer.mobile_password,
  };
}
