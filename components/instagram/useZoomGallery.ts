"use client";

import { useEffect, useMemo, useState } from "react";
import type { InstagramListingPayload, PosterVariant } from "./poster";

export interface ZoomGalleryItem {
  src: string;
  alt: string;
  label: string;
}

export function useZoomGallery({
  selectedVariant,
  collageVariants,
  listing,
}: {
  selectedVariant: PosterVariant | undefined;
  collageVariants: PosterVariant[];
  listing: InstagramListingPayload | null;
}) {
  const [zoomImage, setZoomImage] = useState<ZoomGalleryItem | null>(null);
  const orderedPhotos = useMemo(() => listing?.photos ?? [], [listing]);
  const zoomItems = useMemo(() => {
    const items: ZoomGalleryItem[] = [];
    if (selectedVariant) {
      items.push({ src: selectedVariant.dataUrl, alt: "Selected cover", label: "1. Cover" });
    }
    collageVariants.forEach((variant, index) => {
      items.push({
        src: variant.dataUrl,
        alt: variant.name,
        label: `${index + 2}. ${variant.name}`,
      });
    });
    orderedPhotos.forEach((photo, index) => {
      items.push({
        src: photo.url,
        alt: `Listing photo ${index + 1}`,
        label: `${index + collageVariants.length + 2}. Listing ${index + 1}`,
      });
    });
    return items;
  }, [collageVariants, orderedPhotos, selectedVariant]);

  useEffect(() => {
    if (!zoomImage) return;

    function moveZoom(step: number) {
      setZoomImage((current) => {
        if (!current || zoomItems.length === 0) return current;
        const currentIndex = zoomItems.findIndex((item) => item.src === current.src);
        const nextIndex =
          currentIndex === -1
            ? 0
            : (currentIndex + step + zoomItems.length) % zoomItems.length;
        return zoomItems[nextIndex];
      });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setZoomImage(null);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveZoom(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveZoom(1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomImage, zoomItems]);

  return { orderedPhotos, zoomItems, zoomImage, setZoomImage };
}

