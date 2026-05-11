import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { normalizeVatValue } from '@/lib/vat';
import { parsePositiveIntParam } from '@/lib/api/db-helpers';
import {
  buildBackupForm,
  buildExtrasJson,
  buildTechData,
  getFullFormVat,
  isFullFormBody,
  parseAdStatus,
  parseBinaryInteger,
  parseNonNegativeInteger,
  parseString,
  type BackupRow,
} from './helpers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ backupId: string }> },
) {
  const { backupId: backupIdParam } = await params;
  const backupId = parsePositiveIntParam(backupIdParam);
  if (!backupId) {
    return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
  }

  const row = raw
    .prepare(
      `SELECT dealer_id, make, model, title, fuel, power, transmission, category,
              mileage, color, description, price_amount, price_currency, vat_included,
              year, engine, phones_json, extras_json, tech_data_json
       FROM mobilebg_backups WHERE id = ?`,
    )
    .get(backupId) as BackupRow | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }

  return NextResponse.json({
    form: buildBackupForm(row),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ backupId: string }> },
) {
  try {
    const { backupId: backupIdParam } = await params;
    const backupId = Number(backupIdParam);
    if (!Number.isInteger(backupId) || backupId <= 0) {
      return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (isFullFormBody(payload)) {
      if (!payload.dealerId) {
        return NextResponse.json({ error: 'dealerId required' }, { status: 400 });
      }
      if (!payload.make) {
        return NextResponse.json({ error: 'make required' }, { status: 400 });
      }
      if (!payload.price && !payload.priceOnRequest) {
        return NextResponse.json(
          { error: 'price required unless priceOnRequest is true' },
          { status: 400 },
        );
      }

      const backup = raw.prepare(`
        SELECT id
        FROM mobilebg_backups
        WHERE id = ?
        LIMIT 1
      `).get(backupId) as { id: number } | undefined;

      if (!backup) {
        return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
      }

      const bodyType = payload.body_type ?? payload.bodyType ?? '';
      const productionYear = payload.productionYear ?? '';
      const now = new Date().toISOString();

      raw.prepare(`
        UPDATE mobilebg_backups
        SET
          dealer_id = ?,
          source_title = ?,
          make = ?,
          model = ?,
          title = ?,
          price_amount = ?,
          year = ?,
          mileage = ?,
          fuel = ?,
          power = ?,
          engine = ?,
          color = ?,
          transmission = ?,
          category = ?,
          description = ?,
          vat_included = ?,
          extras_json = ?,
          tech_data_json = ?,
          draft_needs_sync = CASE WHEN listing_id IS NULL THEN draft_needs_sync ELSE 1 END,
          last_mobile_sync_status = CASE WHEN listing_id IS NULL THEN last_mobile_sync_status ELSE 'pending' END,
          last_mobile_sync_error = CASE WHEN listing_id IS NULL THEN last_mobile_sync_error ELSE NULL END,
          updated_at = ?
        WHERE id = ?
      `).run(
        Number(payload.dealerId),
        payload.title || null,
        payload.make || null,
        payload.model || null,
        payload.title || null,
        payload.price ? Number(payload.price) : null,
        productionYear ? Number(productionYear) : null,
        payload.mileage ? Number(payload.mileage) : null,
        payload.fuel || null,
        payload.power ? Number(payload.power) : null,
        payload.engineCc ? `${payload.engineCc} куб.см` : null,
        payload.color || null,
        payload.transmission || null,
        bodyType || null,
        payload.description || null,
        getFullFormVat(payload),
        buildExtrasJson(payload),
        buildTechData(payload),
        now,
        backupId,
      );

      return NextResponse.json({ id: backupId, updated: true });
    }

    const title = parseString(payload.title, 'Title', true);
    const priceAmount = parseNonNegativeInteger(payload.current_price, 'Price');
    const vatIncluded = normalizeVatValue(payload.vat);
    const kaparo = parseBinaryInteger(payload.kaparo, 'Kaparo');
    const adStatus = parseAdStatus(payload.ad_status);

    const backup = raw.prepare(`
      SELECT id
      FROM mobilebg_backups
      WHERE id = ?
      LIMIT 1
    `).get(backupId) as { id: number } | undefined;

    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    raw.prepare(`
      UPDATE mobilebg_backups
      SET
        title = ?,
        price_amount = ?,
        vat_included = ?,
        kaparo = ?,
        ad_status = ?,
        draft_needs_sync = 1,
        last_mobile_sync_status = 'pending',
        last_mobile_sync_error = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(title, priceAmount, vatIncluded, kaparo, adStatus, now, backupId);

    return NextResponse.json({
      backup_id: backupId,
      title,
      current_price: priceAmount,
      vat: vatIncluded,
      kaparo,
      ad_status: adStatus,
      needs_sync: 1,
      last_mobile_sync_status: 'pending',
      last_mobile_sync_error: null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ backupId: string }> },
) {
  const { backupId: backupIdParam } = await params;
  const backupId = parsePositiveIntParam(backupIdParam);
  if (!backupId) {
    return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
  }

  const backup = raw.prepare(`
    SELECT id, listing_id
    FROM mobilebg_backups
    WHERE id = ?
    LIMIT 1
  `).get(backupId) as { id: number; listing_id: string | null } | undefined;

  if (!backup) {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }

  if (backup.listing_id) {
    return NextResponse.json(
      { error: 'Only draft listings without a mobile.bg ID can be deleted here' },
      { status: 400 },
    );
  }

  const deleteDraft = raw.transaction((id: number) => {
    raw.prepare('DELETE FROM mobilebg_backup_images WHERE backup_id = ?').run(id);
    raw.prepare('DELETE FROM mobilebg_edit_form_snapshots WHERE backup_id = ?').run(id);
    raw.prepare('DELETE FROM mobilebg_repost_jobs WHERE backup_id = ?').run(id);
    raw.prepare('DELETE FROM mobilebg_backups WHERE id = ?').run(id);
  });

  deleteDraft(backupId);

  return NextResponse.json({ ok: true, backup_id: backupId });
}
