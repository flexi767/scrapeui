import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { requireDealerScope } from '@/lib/api/auth-helpers';
import { getEditOwnSyncRows } from '@/lib/queries';
import { parsePositiveIntParam } from '@/lib/api/db-helpers';
import { currentIsoTimestamp } from '@/lib/date-format';
import { errorMessage } from '@/lib/utils';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ backupId: string }> }
) {
  try {
    const backupId = parsePositiveIntParam((await params).backupId);
    if (!backupId) {
      return NextResponse.json({ error: 'Invalid backup id' }, { status: 400 });
    }

    const owner = raw.prepare('SELECT dealer_id FROM mobilebg_backups WHERE id = ?').get(backupId) as { dealer_id: number } | undefined;
    if (!owner) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }
    const check = await requireDealerScope(owner.dealer_id);
    if ('error' in check) return check.error;

    const row = getEditOwnSyncRows().find((entry) => entry.backup_id === backupId);
    if (!row) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    raw.prepare(`
      UPDATE mobilebg_backups
      SET
        title = ?,
        price_amount = ?,
        vat_included = ?,
        ad_status = ?,
        kaparo = ?,
        draft_needs_sync = 0,
        last_mobile_sync_status = NULL,
        last_mobile_sync_error = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(
      row.source_title,
      row.source_price,
      row.source_vat,
      row.source_ad_status,
      row.source_kaparo,
      currentIsoTimestamp(),
      backupId,
    );

    const updated = getEditOwnSyncRows().find((entry) => entry.backup_id === backupId);
    return NextResponse.json(updated ?? null);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Failed to revert draft') },
      { status: 500 },
    );
  }
}
