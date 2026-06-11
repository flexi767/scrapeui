'use client';

import Link from "next/link";
import { useTranslations } from 'next-intl';
import { ImageWithFallback } from "@/components/ImageWithFallback";

interface ListingThumbPreviewProps {
  src: string | null | undefined;
  href?: string;
  alt: string;
  previewAlt?: string;
  widthClassName?: string;
  previewWidthClassName?: string;
  placeholderClassName?: string;
  imageClassName?: string;
  fallbackLabel?: string;
  linkedImageClassName?: string;
}

export function ListingThumbPreview({
  src,
  href,
  alt,
  previewAlt,
  widthClassName = "w-16",
  previewWidthClassName = "w-64",
  placeholderClassName = "h-10 w-14 rounded bg-gray-700",
  imageClassName = "w-16 rounded object-contain",
  linkedImageClassName,
  fallbackLabel,
}: ListingThumbPreviewProps) {
  const t = useTranslations('ui');
  const resolvedFallbackLabel = fallbackLabel ?? t('missing');

  if (!src) return <div className={placeholderClassName} />;

  const thumb = (
    <ImageWithFallback
      src={src}
      alt={alt}
      className={linkedImageClassName ?? imageClassName}
      style={{ aspectRatio: "4/3" }}
      fallbackClassName={`${linkedImageClassName ?? imageClassName} bg-gray-800 text-gray-400`}
      fallbackLabel={resolvedFallbackLabel}
    />
  );
  const linkedThumb =
    href && /^https?:\/\//.test(href) ? (
      <a href={href} target="_blank" rel="noreferrer" className="peer block">
        {thumb}
      </a>
    ) : href ? (
      <Link href={href} className="peer block">
        {thumb}
      </Link>
    ) : (
      <div className="peer">{thumb}</div>
    );

  return (
    <div className={`relative inline-block ${widthClassName}`}>
      {linkedThumb}
      <div
        className={`pointer-events-none absolute left-full top-0 z-50 ml-2 hidden ${previewWidthClassName} peer-hover:block`}
      >
        <ImageWithFallback
          src={src}
          alt={previewAlt ?? t('alt_preview', { alt })}
          className="w-full rounded shadow-xl"
          style={{ aspectRatio: "4/3" }}
          fallbackClassName="w-full rounded bg-gray-800 text-gray-400 shadow-xl"
          fallbackLabel={resolvedFallbackLabel}
        />
      </div>
    </div>
  );
}
