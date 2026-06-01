import React from 'react';
import type { PublicListingDetail } from '@/lib/query-modules/public';
import { buildImageList, parseJson, type ImageMeta } from '@/lib/utils';

interface ImageGalleryData {
  listing?: PublicListingDetail;
}

export function renderImageGallery(
  { maxHeight, layout }: Record<string, unknown>,
  data: ImageGalleryData,
) {
  const listing = data.listing;
  if (!listing) return React.createElement('div', null);
  const imageMeta = parseJson<ImageMeta | null>(listing.imageMeta, null);
  const thumbKeys = parseJson<string[]>(listing.thumbKeys, []);
  const fullKeys = parseJson<string[]>(listing.fullKeys, []);
  const images = buildImageList(
    listing.mobileId,
    fullKeys.length ? fullKeys : thumbKeys,
    thumbKeys,
    imageMeta,
    listing.imagesDownloaded === 1,
  );
  const mainHeight = maxHeight ?? 400;
  const altBase = `${listing.make ?? ''} ${listing.model ?? ''}`.trim();

  if (!images.length) {
    return React.createElement('div', {
      style: { background: '#e2e8f0', height: mainHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#94a3b8' },
    }, 'No photos');
  }

  if (layout === 'grid') {
    return React.createElement('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 },
    },
      ...images.slice(0, 9).map((img, index) =>
        React.createElement('img', {
          key: index,
          src: img.full || img.thumb,
          alt: `${altBase} photo ${index + 1}`,
          style: { width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' },
        }),
      ),
    );
  }

  if (layout === 'slider') {
    return React.createElement('div', {
      style: { background: '#000', height: mainHeight, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    },
      React.createElement('img', {
        src: images[0].full || images[0].thumb,
        alt: altBase,
        style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' },
      }),
      images.length > 1
        ? React.createElement('div', {
            style: { position: 'absolute', bottom: 12, right: 16, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12, padding: '2px 8px', borderRadius: 12 },
          }, `1 / ${images.length}`)
        : null,
    );
  }

  return React.createElement('div', null,
    React.createElement('div', {
      style: { background: '#000', height: mainHeight, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    },
      React.createElement('img', {
        src: images[0].full || images[0].thumb,
        alt: altBase,
        style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' },
      }),
    ),
    images.length > 1
      ? React.createElement('div', {
          style: { display: 'flex', gap: 4, padding: '4px 0', overflowX: 'auto' },
        },
          ...images.slice(1, 12).map((img, index) =>
            React.createElement('img', {
              key: index,
              src: img.thumb || img.full,
              alt: `Photo ${index + 2}`,
              style: { height: 72, width: 96, objectFit: 'cover', flexShrink: 0, cursor: 'pointer', borderRadius: 2 },
            }),
          ),
        )
      : null,
  );
}

