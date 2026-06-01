import { type InstagramListingPayload, type PosterVariant } from "../poster";
import { ZoomBadge, type ZoomImage } from "./shared";

interface CarouselOrderStripProps {
  selectedVariant?: PosterVariant;
  collageVariants: PosterVariant[];
  photos: InstagramListingPayload["photos"];
  zoomItems: ZoomImage[];
  onZoom: (image: ZoomImage) => void;
}

export function CarouselOrderStrip({
  selectedVariant,
  collageVariants,
  photos,
  zoomItems,
  onZoom,
}: CarouselOrderStripProps) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Carousel order</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {selectedVariant && (
          <button
            type="button"
            onClick={() => onZoom(zoomItems[0] ?? { src: selectedVariant.dataUrl, alt: "Selected cover", label: "1. Cover" })}
            className="group w-36 shrink-0 overflow-hidden rounded-lg border border-pink-400 bg-gray-900 text-left"
          >
            <span className="relative block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedVariant.dataUrl} alt="Selected cover" className="aspect-square w-full object-cover" />
              <ZoomBadge />
            </span>
            <div className="px-2 py-1 text-xs text-pink-100">1. Cover</div>
          </button>
        )}
        {collageVariants.map((variant, index) => (
          <button
            type="button"
            key={variant.id}
            onClick={() =>
              onZoom({
                src: variant.dataUrl,
                alt: variant.name,
                label: `${index + 2}. ${variant.name}`,
              })
            }
            className="group w-36 shrink-0 overflow-hidden rounded-lg border border-purple-400/70 bg-gray-900 text-left hover:border-purple-300"
          >
            <span className="relative block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={variant.dataUrl} alt={variant.name} className="aspect-square w-full object-cover" />
              <ZoomBadge />
            </span>
            <div className="px-2 py-1 text-xs text-purple-100">{index + 2}. {variant.name}</div>
          </button>
        ))}
        {photos.map((photo, index) => (
          <button
            type="button"
            key={photo.id}
            onClick={() =>
              onZoom({
                src: photo.url,
                alt: `Listing photo ${index + 1}`,
                label: `${index + collageVariants.length + 2}. Listing ${index + 1}`,
              })
            }
            className="group w-36 shrink-0 overflow-hidden rounded-lg border border-gray-800 bg-gray-900 text-left hover:border-gray-600"
          >
            <span className="relative block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`Listing photo ${index + 1}`} className="aspect-square w-full object-cover" />
              <ZoomBadge />
            </span>
            <div className="px-2 py-1 text-xs text-gray-300">{index + collageVariants.length + 2}. Listing {index + 1}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
