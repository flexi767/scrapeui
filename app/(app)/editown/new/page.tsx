import Link from 'next/link';
import NewListingForm from '@/components/NewListingForm';
import { fetchMakesModels } from '@/lib/mobile-bg/makes-models';
import { fetchFuelTypes } from '@/lib/mobile-bg/fuel-types';
import { fetchTransmissionTypes } from '@/lib/mobile-bg/transmission-types';
import { CANONICAL_BODY_TYPES } from '@/lib/mobile-bg/body-types';
import { fetchRegions } from '@/lib/mobile-bg/regions';
import { MOBILE_BG_COLORS } from '@/lib/mobile-bg/colors';
import { raw } from '@/db/client';

interface DealerRow { id: number; slug: string; name: string; }

function getOwnDealers(): DealerRow[] {
  return raw.prepare(
    `SELECT id, slug, name FROM dealers WHERE own = 1 AND active = 1 ORDER BY priority DESC, name`
  ).all() as DealerRow[];
}

export default async function NewListingPage() {
  const [makesMap, fuelMap, transmissionMap, regions] = await Promise.all([
    fetchMakesModels().catch(() => null),
    fetchFuelTypes().catch(() => null),
    fetchTransmissionTypes().catch(() => null),
    fetchRegions().catch(() => []),
  ]);

  const makes = makesMap
    ? Array.from(makesMap.values()).sort((a, b) => a.make.localeCompare(b.make, 'bg'))
    : [];

  const fuels = fuelMap
    ? Array.from(fuelMap.values())
    : [];

  const transmissions = transmissionMap
    ? Array.from(transmissionMap.values())
    : [];

  const dealers = getOwnDealers();

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link href="/editown" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            ← Own Listings
          </Link>
          <span className="text-sm font-medium text-gray-300">Нова обява</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <NewListingForm
          makes={makes}
          fuels={fuels}
          transmissions={transmissions}
          bodyTypes={[...CANONICAL_BODY_TYPES]}
          regions={regions}
          colors={[...MOBILE_BG_COLORS]}
          dealers={dealers}
        />
      </main>
    </div>
  );
}
