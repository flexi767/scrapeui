import React from 'react';
import type { PublicListing } from '@/lib/query-modules/public';
import { formatListingMileage, formatListingPrice } from '@/lib/listing-format';
import { getListingThumbSrc, getListingThumbSrcFromParts } from '@/lib/listing-thumb';

function getPublicListingThumbSrc(listing: PublicListing) {
  if (listing.firstThumbKey || listing.firstFullKey) {
    return getListingThumbSrcFromParts({
      mobile_id: listing.mobileId,
      first_thumb_key: listing.firstThumbKey,
      first_full_key: listing.firstFullKey,
      image_cdn: listing.imageCdn,
      image_shard: listing.imageShard,
      images_downloaded: listing.imagesDownloaded,
      thumb_saved: listing.thumbSaved,
    });
  }

  return getListingThumbSrc({
    mobile_id: listing.mobileId,
    thumb_keys: listing.thumbKeys,
    full_keys: listing.fullKeys,
    image_meta: listing.imageMeta,
    images_downloaded: listing.imagesDownloaded,
    thumb_saved: listing.thumbSaved,
  });
}

function listingTitle(listing: PublicListing) {
  return `${listing.make ?? ''} ${listing.model ?? ''} ${listing.regYear ?? ''}`.trim();
}

export function renderListingGridCard(
  listing: PublicListing,
  options: {
    cardStyle: unknown;
    showPrice: unknown;
    showMileage: unknown;
    showYear: unknown;
    showFuel: unknown;
  },
) {
  const thumbSrc = getPublicListingThumbSrc(listing);
  return React.createElement('a', {
    key: listing.mobileId,
    href: `${listing.mobileId}`,
    style: { borderRadius: options.cardStyle === 'card' ? 8 : 0, border: options.cardStyle === 'card' ? '1px solid #e2e8f0' : 'none', overflow: 'hidden', background: '#fff', display: 'block', textDecoration: 'none', color: 'inherit' },
  },
    React.createElement('div', { style: { height: 160, background: '#e2e8f0', overflow: 'hidden', position: 'relative' } },
      thumbSrc
        ? React.createElement('img', { src: thumbSrc, alt: `${listing.make ?? ''} ${listing.model ?? ''}`.trim(), style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } })
        : null,
    ),
    React.createElement('div', { style: { padding: '8px 12px' } },
      React.createElement('div', { style: { fontWeight: 600, fontSize: 14, marginBottom: 4 } }, listingTitle(listing)),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#64748b' } },
        options.showPrice !== false && listing.currentPrice ? React.createElement('span', { key: 'price' }, formatListingPrice(listing.currentPrice)) : null,
        options.showYear !== false && listing.regYear ? React.createElement('span', { key: 'year' }, listing.regYear) : null,
        options.showMileage !== false && listing.mileage ? React.createElement('span', { key: 'km' }, formatListingMileage(listing.mileage)) : null,
        options.showFuel !== false && listing.fuel ? React.createElement('span', { key: 'fuel' }, listing.fuel) : null,
      ),
    ),
  );
}

export function renderRelatedListingCard(listing: PublicListing, bordered: boolean) {
  const thumbSrc = getPublicListingThumbSrc(listing);
  return React.createElement('a', {
    key: listing.mobileId,
    href: listing.mobileId,
    style: { display: 'block', border: bordered ? '1px solid #e2e8f0' : 'none', borderRadius: bordered ? 8 : 0, overflow: 'hidden', textDecoration: 'none', color: 'inherit', background: '#fff' },
  },
    React.createElement('div', { style: { height: 120, background: '#f1f5f9', overflow: 'hidden' } },
      thumbSrc
        ? React.createElement('img', { src: thumbSrc, alt: `${listing.make ?? ''} ${listing.model ?? ''}`.trim(), style: { width: '100%', height: '100%', objectFit: 'cover' } })
        : null,
    ),
    React.createElement('div', { style: { padding: '8px 10px' } },
      React.createElement('div', { style: { fontWeight: 600, fontSize: 13 } }, listingTitle(listing)),
      listing.currentPrice
        ? React.createElement('div', { style: { color: '#2563eb', fontSize: 13, marginTop: 2 } }, formatListingPrice(listing.currentPrice))
        : null,
    ),
  );
}
