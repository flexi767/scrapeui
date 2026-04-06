import { raw } from '@/db/client';
import { getOwnListingByMobileId } from '@/lib/queries';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ mobileId: string }> }
) {
  try {
    const mobileId = (await params).mobileId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // Type assertion for body fields
    const bodyData = body as Record<string, unknown>;

    // Validate title
    const title = bodyData.title;
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }
    const trimmedTitle = title.trim();

    const carsbgTitleRaw = bodyData.carsbg_title;
    if (typeof carsbgTitleRaw !== 'string') {
      return NextResponse.json(
        { error: 'Invalid cars.bg title value' },
        { status: 400 }
      );
    }
    const trimmedCarsbgTitle = carsbgTitleRaw.trim();
    if (trimmedCarsbgTitle.length > 15) {
      return NextResponse.json(
        { error: 'cars.bg title must be 15 characters or fewer' },
        { status: 400 }
      );
    }
    const carsbgTitleForDb = trimmedCarsbgTitle || null;

    // Validate current_price
    const currentPrice = bodyData.current_price;
    if (
      typeof currentPrice !== 'number' ||
      !Number.isInteger(currentPrice) ||
      currentPrice < 0
    ) {
      return NextResponse.json(
        { error: 'Price must be a non-negative integer' },
        { status: 400 }
      );
    }

    // Validate vat
    const vat = bodyData.vat;
    const validVatValues = ['', 'included', 'exempt', 'excluded'];
    if (typeof vat !== 'string' || !validVatValues.includes(vat)) {
      return NextResponse.json(
        { error: 'Invalid vat value' },
        { status: 400 }
      );
    }
    // Store empty string as null in DB
    const vatForDb = vat === '' ? null : vat;

    // Validate kaparo
    const kaparo = bodyData.kaparo;
    if (kaparo !== 0 && kaparo !== 1) {
      return NextResponse.json(
        { error: 'Invalid kaparo value' },
        { status: 400 }
      );
    }

    // Validate ad_status
    const adStatus = bodyData.ad_status;
    const validAdStatuses = ['none', 'TOP', 'VIP'];
    if (typeof adStatus !== 'string' || !validAdStatuses.includes(adStatus)) {
      return NextResponse.json(
        { error: 'Invalid ad_status value' },
        { status: 400 }
      );
    }

    // Fetch the listing
    const listing = getOwnListingByMobileId(mobileId);
    if (!listing) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      );
    }

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

    const nothingChanged =
      trimmedTitle === (listing.title ?? '').trim() &&
      carsbgTitleForDb === (listing.carsbg_title ?? null) &&
      currentPrice === (listing.current_price ?? 0) &&
      vatForDb === (listing.vat ?? null) &&
      kaparo === (listing.kaparo ?? 0) &&
      adStatus === (listing.ad_status ?? 'none');

    if (nothingChanged) {
      return NextResponse.json(listing);
    }

    if (carsbgTitleForDb !== (listing.carsbg_title ?? null)) {
      raw
        .prepare(
          `UPDATE listings
           SET carsbg_title = ?
           WHERE mobile_id = ?`
        )
        .run(carsbgTitleForDb, mobileId);
    }

    const mobileFieldsChanged =
      trimmedTitle !== (listing.title ?? '').trim() ||
      currentPrice !== (listing.current_price ?? 0) ||
      vatForDb !== (listing.vat ?? null) ||
      kaparo !== (listing.kaparo ?? 0) ||
      adStatus !== (listing.ad_status ?? 'none');

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
        adStatus,
        new Date().toISOString(),
        backup.id,
      );

    // Re-fetch the listing
    const updatedListing = getOwnListingByMobileId(mobileId);

    return NextResponse.json(updatedListing);
  } catch (error) {
    console.error('PATCH /api/listings/[mobileId] error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
