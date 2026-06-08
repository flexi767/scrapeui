'use client';

import { useTranslations } from 'next-intl';
import { ImageWithFallback } from '@/components/ImageWithFallback';

interface SearchPositionPreviewThumbProps {
  thumbUrl: string | null;
  listingUrl: string | null;
  label: string;
}

export function SearchPositionPreviewThumb({ thumbUrl, listingUrl, label }: SearchPositionPreviewThumbProps) {
  const t = useTranslations('ui');

  const content = thumbUrl ? (
    <ImageWithFallback
      src={thumbUrl}
      alt={label}
      className="h-14 w-[76px] rounded bg-gray-800 object-cover"
      fallbackClassName="flex h-14 w-[76px] items-center justify-center rounded bg-gray-800 text-[10px] uppercase tracking-wide text-gray-500"
      fallbackLabel={t('no_image')}
      style={{ aspectRatio: '4/3' }}
    />
  ) : (
    <div className="flex h-14 w-[76px] items-center justify-center rounded bg-gray-800 text-[10px] uppercase tracking-wide text-gray-500">
      {t('no_image')}
    </div>
  );

  if (listingUrl) {
    return (
      <a href={listingUrl} className="shrink-0 transition-opacity hover:opacity-80">
        {content}
      </a>
    );
  }

  return <div className="shrink-0">{content}</div>;
}
