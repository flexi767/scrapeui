import ConfigShell from '@/components/ConfigShell';
import type { Dealer } from '@/components/dealers/types';
import { raw } from '@/db/client';
import { PLATFORM_ACCOUNT_COLUMNS } from '@/lib/dealers/platformCredentials';
import { SOCIAL_ACCOUNT_COLUMNS } from '@/lib/dealers/socialCredentials';

interface DealerRow extends Dealer {
  created_at: string | null;
}


function getDealers(): DealerRow[] {
  return raw.prepare(`
    SELECT
      id, slug, name, own, active, priority,
      ${PLATFORM_ACCOUNT_COLUMNS},
      ${SOCIAL_ACCOUNT_COLUMNS},
      public_enabled, template, public_domain, active_template_config_id, created_at
    FROM dealers
    ORDER BY priority DESC, name
  `).all() as DealerRow[];
}

export default async function ConfigPage() {
  const dealers = getDealers();

  return (
    <div className="min-h-screen bg-[#111827]">
      <main className="mx-auto max-w-screen-2xl px-4 py-8 space-y-10">
        <ConfigShell initialDealers={dealers} />
      </main>
    </div>
  );
}
