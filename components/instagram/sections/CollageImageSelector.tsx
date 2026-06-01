import { RefreshCwIcon } from "lucide-react";
import {
  type CollageSelections,
  type InstagramListingPayload,
} from "../poster";
import { StepHeader, ZoomBadge, type ZoomImage } from "./shared";

interface CollageImageSelectorProps {
  photos: InstagramListingPayload["photos"];
  selections: CollageSelections;
  generating: boolean;
  onToggle: (kind: keyof CollageSelections, photoId: number) => void;
  onDefaults: () => void;
  onGenerate: () => void;
  onZoom: (image: ZoomImage) => void;
}

export function CollageImageSelector({
  photos,
  selections,
  generating,
  onToggle,
  onDefaults,
  onGenerate,
  onZoom,
}: CollageImageSelectorProps) {
  const canGenerate = selections.exteriorPhotoIds.length > 0 && selections.interiorPhotoIds.length > 0;

  return (
    <details open className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-white marker:text-gray-500">
        Step 2
      </summary>
      <div className="mb-3 mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <StepHeader
          step="Step 2"
          title="Choose collage images"
          detail={`Exterior ${selections.exteriorPhotoIds.length} / Interior ${selections.interiorPhotoIds.length}`}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDefaults}
            className="inline-flex h-8 items-center rounded-md border border-gray-700 px-3 text-xs text-gray-200 hover:bg-gray-800"
          >
            Defaults
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {photos.map((photo, index) => {
          const exteriorSelected = selections.exteriorPhotoIds.includes(photo.id);
          const interiorSelected = selections.interiorPhotoIds.includes(photo.id);
          return (
            <div
              key={photo.id}
              className={`overflow-hidden rounded-lg border bg-gray-950 ${
                exteriorSelected || interiorSelected ? "border-pink-400/70" : "border-gray-800"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  onZoom({
                    src: photo.url,
                    alt: `Listing photo ${index + 1}`,
                    label: `Listing ${index + 1}`,
                  })
                }
                className="group relative block w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Listing photo ${index + 1}`} className="aspect-square w-full object-cover" />
                <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <ZoomBadge />
              </button>
              <div className="grid grid-cols-2 gap-2 p-2 text-xs text-gray-200">
                <label className="flex cursor-pointer items-center gap-2 rounded border border-gray-800 px-2 py-1.5 hover:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={exteriorSelected}
                    onChange={() => onToggle("exteriorPhotoIds", photo.id)}
                    className="h-3.5 w-3.5 accent-pink-500"
                  />
                  Exterior
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded border border-gray-800 px-2 py-1.5 hover:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={interiorSelected}
                    onChange={() => onToggle("interiorPhotoIds", photo.id)}
                    className="h-3.5 w-3.5 accent-purple-500"
                  />
                  Interior
                </label>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-2 rounded-md border border-gray-800 bg-gray-950 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-gray-400">
          {canGenerate
            ? "Ready to generate. Existing cached images will be reused when possible."
            : "Select at least one exterior and one interior image."}
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !canGenerate}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-pink-600 px-4 text-sm font-medium text-white hover:bg-pink-500 disabled:opacity-50"
        >
          <RefreshCwIcon className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generating..." : "Generate posters"}
        </button>
      </div>
    </details>
  );
}
