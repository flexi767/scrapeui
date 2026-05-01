import Link from 'next/link';
import ConfigShell from '@/components/ConfigShell';
import type { Dealer } from '@/components/dealers/types';
import { raw } from '@/db/client';

interface DealerRow extends Dealer {
  created_at: string | null;
}

function getDealers(): DealerRow[] {
  return raw.prepare('SELECT id, slug, name, mobile_url, own, active, priority, cars_url, mobile_user, mobile_password, cars_user, cars_password, public_enabled, template, public_domain, created_at FROM dealers ORDER BY priority DESC, name').all() as DealerRow[];
}

export default function ConfigPage() {
  const dealers = getDealers();

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/listings" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
              ← Listings
            </Link>
            <span className="text-sm font-medium text-gray-400">⚙ Config</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-8 space-y-10">
        <ConfigShell initialDealers={dealers} />
      </main>
    </div>
  );
}
