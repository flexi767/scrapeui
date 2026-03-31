'use client';

import { useState } from 'react';

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className,
  style,
  fallbackClassName,
  fallbackLabel = 'Image unavailable',
  onError,
  ...imgProps
}: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={fallbackClassName ?? className ?? 'flex items-center justify-center bg-gray-800 text-gray-400'}
        style={style}
        role="img"
        aria-label={alt || fallbackLabel}
      >
        <div className="flex h-full w-full items-center justify-center rounded-inherit bg-gradient-to-br from-gray-800 to-gray-900">
          <span className="rounded bg-black/30 px-2 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-gray-300">
            {fallbackLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      {...imgProps}
    />
  );
}
