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

    // Update the listing
    raw
      .prepare(
        `UPDATE listings SET title = ?, current_price = ?, vat = ?, kaparo = ?, ad_status = ?, needs_sync = 1 WHERE mobile_id = ?`
      )
      .run(trimmedTitle, currentPrice, vatForDb, kaparo, adStatus, mobileId);

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
