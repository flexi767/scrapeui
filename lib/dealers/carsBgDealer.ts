import type { CarsBgDealerAccount } from '@/lib/cars-bg/sync';

export interface CarsBgDealerSource {
  cars_password?: string | null;
  cars_url?: string | null;
  cars_user?: string | null;
  id: number;
  name?: string | null;
  slug: string;
}

export function getCarsBgDealerAccount(
  dealer: CarsBgDealerSource | null | undefined,
): CarsBgDealerAccount | null {
  if (!dealer?.cars_user || !dealer.cars_password) return null;

  return {
    id: dealer.id,
    slug: dealer.slug,
    name: dealer.name ?? null,
    carsUrl: dealer.cars_url ?? null,
    carsUser: dealer.cars_user,
    carsPassword: dealer.cars_password,
  };
}
