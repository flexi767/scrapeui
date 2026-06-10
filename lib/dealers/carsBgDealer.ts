import type { CarsBgDealerAccount } from '@/lib/cars-bg/sync';
import { decryptSecret } from '@/lib/crypto-credentials';

export interface CarsBgDealerSource {
  cars_password?: string | null;
  cars_url?: string | null;
  cars_user?: string | null;
  id: number;
  name?: string | null;
  slug: string;
}

export type AuthenticatedCarsBgDealerAccount = CarsBgDealerAccount & {
  carsPassword: string;
  carsUser: string;
};

export function getCarsBgDealerAccount(
  dealer: CarsBgDealerSource | null | undefined,
): AuthenticatedCarsBgDealerAccount | null {
  const decryptedPassword = decryptSecret(dealer?.cars_password);
  if (!dealer?.cars_user || !decryptedPassword) return null;

  return {
    id: dealer.id,
    slug: dealer.slug,
    name: dealer.name ?? null,
    carsUrl: dealer.cars_url ?? null,
    carsUser: dealer.cars_user,
    carsPassword: decryptedPassword,
  };
}
