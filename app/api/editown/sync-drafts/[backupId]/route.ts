import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { getEditOwnSyncRows } from '@/lib/queries';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ backupId: string }> }
) {
  try {
    const backupId = Number((await params).backupId);
    if (!Number.isInteger(backupId) || backupId <= 0) {
      return NextResponse.json({ error: 'Invalid backup id' }, { status: 400 });
    }

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
      new Date().toISOString(),
      backupId,
    );

    const updated = getEditOwnSyncRows().find((entry) => entry.backup_id === backupId);
    return NextResponse.json(updated ?? null);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revert draft' },
      { status: 500 },
    );
  }
}
