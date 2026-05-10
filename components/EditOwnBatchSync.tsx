'use client';

import type { EditOwnSyncRow } from '@/lib/queries';
import { BatchSyncPanel } from './edit-own-batch-sync/BatchSyncPanel';
import { ChangedListingsTable } from './edit-own-batch-sync/ChangedListingsTable';
import { DoneSummaryBanner } from './edit-own-batch-sync/DoneSummaryBanner';
import { LogPanel } from './edit-own-batch-sync/LogPanel';
import { RecentResults } from './edit-own-batch-sync/RecentResults';
import { RenewResetPanel } from './edit-own-batch-sync/RenewResetPanel';
import { useBatchSync } from './edit-own-batch-sync/useBatchSync';
import { useRenewReset } from './edit-own-batch-sync/useRenewReset';
import type { OwnDealer } from './edit-own-batch-sync/types';

interface Props {
  initialRows: EditOwnSyncRow[];
  autoRun?: boolean;
  ownDealers: OwnDealer[];
}

export default function EditOwnBatchSync({ initialRows, autoRun = false, ownDealers }: Props) {
  const sync = useBatchSync(initialRows, autoRun);
  const renew = useRenewReset(ownDealers);

  return (
    <div className="space-y-6">
      <BatchSyncPanel
        currentLabel={sync.currentLabel}
        doneSummary={sync.doneSummary}
        failedCount={sync.rowCounts.failed}
        pendingCount={sync.rowCounts.pending}
        running={sync.running}
        stats={sync.stats}
        stopping={sync.stopping}
        successCount={sync.rowCounts.success}
        onRunOrStop={sync.running ? sync.stop : () => void sync.run()}
      />

      <DoneSummaryBanner summary={sync.doneSummary} />

      <RecentResults rows={sync.recentResults} />

      <ChangedListingsTable
        rows={sync.rows}
        running={sync.running}
        revertingId={sync.revertingId}
        onRevert={(row) => void sync.revertDraft(row)}
      />

      {sync.logs.length > 0 && (
        <LogPanel entries={sync.logs} panelRef={sync.logRef} />
      )}

      <RenewResetPanel
        ownDealers={ownDealers}
        renewDealers={renew.renewDealers}
        renewOnlyReset={renew.renewOnlyReset}
        renewRunning={renew.renewRunning}
        renewStopping={renew.renewStopping}
        renewStats={renew.renewStats}
        renewDone={renew.renewDone}
        renewLogs={renew.renewLogs}
        running={sync.running}
        renewLogRef={renew.renewLogRef}
        onToggleDealer={renew.toggleDealer}
        onToggleAllDealers={renew.toggleAllDealers}
        onToggleOnlyReset={renew.toggleOnlyReset}
        onRunOrStop={renew.renewRunning ? renew.stopRenewReset : () => void renew.runRenewReset()}
      />
    </div>
  );
}
