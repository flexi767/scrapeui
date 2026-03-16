'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';

interface Image {
  full: string;
  thumb: string;
}

interface Props {
  images: Image[];
  title?: string;
}

export default function EmblaCarousel({ images, title }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const [mainRef, mainApi] = useEmblaCarousel({ loop: true });
  const [thumbsRef, thumbsApi] = useEmblaCarousel({
    containScroll: 'keepSnaps',
    dragFree: true,
  });

  const onThumbClick = useCallback(
    (index: number) => {
      if (!mainApi) return;
      mainApi.scrollTo(index);
    },
    [mainApi],
  );

  const onSelect = useCallback(() => {
    if (!mainApi || !thumbsApi) return;
    const idx = mainApi.selectedScrollSnap();
    setSelectedIndex(idx);
    thumbsApi.scrollTo(idx);
  }, [mainApi, thumbsApi]);

  useEffect(() => {
    if (!mainApi) return;
    onSelect();
    mainApi.on('select', onSelect);
    mainApi.on('reInit', onSelect);
    return () => {
      mainApi.off('select', onSelect);
      mainApi.off('reInit', onSelect);
    };
  }, [mainApi, onSelect]);

  const scrollPrev = useCallback(() => mainApi?.scrollPrev(), [mainApi]);
  const scrollNext = useCallback(() => mainApi?.scrollNext(), [mainApi]);

  if (!images.length) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-gray-800 text-gray-500">
        No images
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Main viewport */}
      <div className="relative overflow-hidden rounded-lg bg-gray-900" ref={mainRef}>
        <div className="flex">
          {images.map((img, i) => (
            <div key={i} className="min-w-0 flex-[0_0_100%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.full}
                alt={title ? `${title} — photo ${i + 1}` : `Photo ${i + 1}`}
                className="aspect-[4/3] w-full cursor-zoom-in object-cover"
                onClick={() => setLightbox(img.full)}
              />
            </div>
          ))}
        </div>

        {/* Prev / Next */}
        <button
          onClick={scrollPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          aria-label="Previous image"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={scrollNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          aria-label="Next image"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Counter */}
        <div className="absolute bottom-2 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
          {selectedIndex + 1} / {images.length}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => { if (zoomed) { setZoomed(false); } else { setLightbox(null); } }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-screen max-w-full object-contain p-4 transition-transform duration-200"
            style={{
              transformOrigin: origin,
              transform: zoomed ? 'scale(2.5)' : 'scale(1)',
              cursor: zoomed ? 'zoom-out' : 'zoom-in',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!zoomed) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                setOrigin(`${x}% ${y}%`);
              }
              setZoomed(z => !z);
            }}
          />
          <button
            onClick={() => { setZoomed(false); setLightbox(null); }}
            className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/90"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Thumbnail strip */}
      <div className="overflow-hidden" ref={thumbsRef}>
        <div className="flex gap-1.5">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => onThumbClick(i)}
              className={`flex-[0_0_72px] overflow-hidden rounded transition-opacity ${
                i === selectedIndex
                  ? 'ring-2 ring-blue-500 opacity-100'
                  : 'opacity-50 hover:opacity-80'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumb}
                alt=""
                className="h-12 w-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
