import { raw } from '@/db/client';
import { requireAuth } from '@/lib/api/auth-helpers';
import { normalizeCarsBgShortTitle } from '@/lib/cars-bg/title';
import { getOwnListingByMobileId } from '@/lib/queries';
import { currentIsoTimestamp } from '@/lib/date-format';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const log = logger.child('listings');

const patchBodySchema = z.object({
  title: z.string().refine(s => s.trim().length > 0, { message: 'Title is required' }),
  carsbg_title: z.string(),
  current_price: z.number().int().nonnegative(),
  vat: z.enum(['', 'included', 'exempt', 'excluded']),
  kaparo: z.union([z.literal(0), z.literal(1)]),
  ad_status: z.enum(['none', 'TOP', 'VIP']),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ mobileId: string }> }
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  try {
    const mobileId = (await params).mobileId;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    const parsed = patchBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, carsbg_title: carsbgTitleRaw, current_price: currentPrice, vat, kaparo, ad_status: adStatus } = parsed.data;
    const trimmedTitle = title.trim();
    const trimmedCarsbgTitle = normalizeCarsBgShortTitle(carsbgTitleRaw);
    const carsbgTitleForDb = trimmedCarsbgTitle || null;
    // Store empty string as null in DB
    const vatForDb = vat === '' ? null : vat;

    // Fetch the listing
    const listing = getOwnListingByMobileId(mobileId);
    if (!listing) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      );
    }

    const sourceListing = raw.prepare(`
      SELECT id, title, current_price, vat, kaparo, ad_status, carsbg_title, is_active
      FROM listings
      WHERE mobile_id = ?
      LIMIT 1
    `).get(mobileId) as {
      id: number;
      title: string | null;
      current_price: number | null;
      vat: string | null;
      kaparo: number | null;
      ad_status: string | null;
      carsbg_title: string | null;
      is_active: number | null;
    } | undefined;

    if (!sourceListing) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      );
    }

    const sourceAdStatus = sourceListing.ad_status ?? 'none';
    const sourceIsLiveOnMobile = (sourceListing.is_active ?? 0) === 1;
    const effectiveAdStatus =
      adStatus === 'none' && sourceAdStatus !== 'none' && sourceIsLiveOnMobile
        ? sourceAdStatus
        : adStatus;

    const backup = raw.prepare(`
      SELECT b.id
      FROM mobilebg_backups b
      JOIN listings l ON l.id = b.listing_id
      JOIN dealers d ON d.id = b.dealer_id
      WHERE l.mobile_id = ? AND d.own = 1
      LIMIT 1
    `).get(mobileId) as { id?: number } | undefined;

    if (!backup?.id) {
      return NextResponse.json(
        { error: 'No editable backup draft found for this listing' },
        { status: 404 }
      );
    }

    const currentTitle = (listing.title ?? '').trim();
    const currentCarsbgTitle = listing.carsbg_title ?? null;
    const currentPriceValue = listing.current_price ?? 0;
    const currentVat = listing.vat ?? null;
    const currentKaparo = listing.kaparo ?? 0;
    const currentAdStatus = listing.ad_status ?? 'none';

    const nothingChanged =
      trimmedTitle === currentTitle &&
      carsbgTitleForDb === currentCarsbgTitle &&
      currentPrice === currentPriceValue &&
      vatForDb === currentVat &&
      kaparo === currentKaparo &&
      effectiveAdStatus === currentAdStatus;

    if (nothingChanged) {
      return NextResponse.json(listing);
    }

    if (carsbgTitleForDb !== (sourceListing.carsbg_title ?? null)) {
      raw
        .prepare(
          `UPDATE listings
           SET carsbg_title = ?
           WHERE mobile_id = ?`
        )
        .run(carsbgTitleForDb, mobileId);
    }

    const mobileFieldsChanged =
      trimmedTitle !== currentTitle ||
      currentPrice !== currentPriceValue ||
      vatForDb !== currentVat ||
      kaparo !== currentKaparo ||
      effectiveAdStatus !== currentAdStatus;

    if (!mobileFieldsChanged) {
      const updatedListing = getOwnListingByMobileId(mobileId);
      return NextResponse.json(updatedListing);
    }

    raw
      .prepare(
        `UPDATE mobilebg_backups
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
         WHERE id = ?`
      )
      .run(
        trimmedTitle,
        currentPrice,
        vatForDb,
        kaparo,
        effectiveAdStatus,
        currentIsoTimestamp(),
        backup.id,
      );

    // Re-fetch the listing
    const updatedListing = getOwnListingByMobileId(mobileId);

    return NextResponse.json(updatedListing);
  } catch (error) {
    log.error('PATCH /api/listings/[mobileId] error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
