import { InstagramIcon, RefreshCwIcon, ZoomInIcon } from "lucide-react";
import {
  formatPosterMileage,
  formatPosterPrice,
  type CollageSelections,
  type InstagramListingPayload,
  type PosterVariant,
  type PosterVariantPrompt,
} from "./poster";

type ZoomImage = { src: string; alt: string; label: string };

function StepHeader({
  step,
  title,
  detail,
}: {
  step: string;
  title: string;
  detail?: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-pink-300">{step}</div>
      <h2 className="mt-1 text-sm font-semibold text-white">{title}</h2>
      {detail ? <p className="mt-1 text-xs text-gray-500">{detail}</p> : null}
    </div>
  );
}

interface PosterPromptPanelProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onReset: () => void;
}

export function PosterPromptPanel({
  prompt,
  onPromptChange,
  onReset,
}: PosterPromptPanelProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <StepHeader
          step="Step 1"
          title="Set the style"
          detail="This main prompt controls the overall look of the cover and collage pages."
        />
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-8 items-center self-start rounded-md border border-gray-700 px-3 text-xs text-gray-200 hover:bg-gray-800 sm:self-auto"
        >
          Reset
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        rows={6}
        className="w-full resize-y rounded-md border border-gray-700 bg-gray-950 p-3 text-sm leading-6 text-gray-200 outline-none focus:border-pink-400"
      />
    </div>
  );
}

interface VariantPromptPanelProps {
  prompts: PosterVariantPrompt[];
  onPromptChange: (id: string, prompt: string) => void;
}

export function VariantPromptPanel({ prompts, onPromptChange }: VariantPromptPanelProps) {
  return (
    <details className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-white marker:text-gray-500">
        Advanced variant prompts
      </summary>
      <div className="mt-1 text-xs text-gray-500">
        Fine-tune each generated page only when the default flow is not enough.
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {prompts.map((variant) => (
          <label key={variant.id} className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{variant.name}</span>
            <textarea
              value={variant.prompt}
              onChange={(event) => onPromptChange(variant.id, event.target.value)}
              rows={5}
              className="mt-1 w-full resize-y rounded-md border border-gray-700 bg-gray-950 p-3 text-xs leading-5 text-gray-200 outline-none focus:border-pink-400"
            />
          </label>
        ))}
      </div>
    </details>
  );
}

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
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                  <ZoomInIcon className="h-3.5 w-3.5" />
                </span>
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
    </div>
  );
}

interface GeneratedImageSectionsProps {
  expectedVariants: PosterVariantPrompt[];
  coverVariants: PosterVariant[];
  collageVariants: PosterVariant[];
  selectedVariantId: string;
  generating: boolean;
  generatingVariantIds: string[];
  hasVariants: boolean;
  onSelectCover: (id: string) => void;
  onRegenerate: () => void;
  onGenerateVariant: (id: string, force: boolean) => void;
  onZoom: (image: ZoomImage) => void;
}

export function GeneratedImageSections({
  expectedVariants,
  coverVariants,
  collageVariants,
  selectedVariantId,
  generating,
  generatingVariantIds,
  hasVariants,
  onSelectCover,
  onRegenerate,
  onGenerateVariant,
  onZoom,
}: GeneratedImageSectionsProps) {
  const variantsById = new Map([...coverVariants, ...collageVariants].map((variant) => [variant.id, variant]));
  const expectedCoverVariants = expectedVariants.filter((variant) => variant.role !== "collage");
  const expectedCollageVariants = expectedVariants.filter((variant) => variant.role === "collage");

  function renderVariantCard(expected: PosterVariantPrompt, index: number) {
    const variant = variantsById.get(expected.id);
    const isGenerating = generatingVariantIds.includes(expected.id);
    const isSelected = selectedVariantId === expected.id;
    const isCover = expected.role !== "collage";

    return (
      <div
        key={expected.id}
        className={`overflow-hidden rounded-lg border bg-gray-900 text-left transition ${
          isSelected
            ? "border-pink-400 ring-2 ring-pink-400/30"
            : "border-gray-800 hover:border-gray-600"
        }`}
      >
        {variant ? (
          <span className="group relative block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={variant.dataUrl} alt={variant.name} className="aspect-square w-full object-cover" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onZoom({ src: variant.dataUrl, alt: variant.name, label: variant.name });
              }}
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition hover:bg-black/85 group-hover:opacity-100 focus:opacity-100"
              aria-label={`Zoom ${variant.name}`}
            >
              <ZoomInIcon className="h-4 w-4" />
            </button>
          </span>
        ) : (
          <div className="flex aspect-square items-center justify-center bg-gray-950 p-4 text-center text-xs text-gray-500">
            {isGenerating ? "Generating..." : `${index + 1}. ${expected.name}`}
          </div>
        )}
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2">
          {isCover ? (
            <button
              type="button"
              onClick={() => onSelectCover(expected.id)}
              disabled={!variant}
              className="min-w-0 truncate text-left text-sm font-medium text-white hover:text-pink-100 disabled:text-gray-500"
            >
              {expected.name}
            </button>
          ) : (
            <div className="min-w-0 truncate text-sm font-medium text-white">{expected.name}</div>
          )}
          <button
            type="button"
            onClick={() => onGenerateVariant(expected.id, Boolean(variant))}
            disabled={generating}
            className="inline-flex h-7 items-center gap-1.5 rounded border border-gray-700 px-2 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCwIcon className={`h-3 w-3 ${isGenerating ? "animate-spin" : ""}`} />
            {variant ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <StepHeader
          step="Step 3"
          title="Review and choose cover"
          detail="The two collage pages are added to the carousel automatically."
        />
        <button
          type="button"
          onClick={onRegenerate}
          disabled={generating}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-gray-700 px-3 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCwIcon className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {expectedCoverVariants.map(renderVariantCard)}
        {!hasVariants && expectedCoverVariants.length === 0 && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-sm text-gray-400">
            {generating ? "Generating poster options..." : "Generate posters after selecting collage images."}
          </div>
        )}
      </div>

      {expectedCollageVariants.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Collage pages</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {expectedCollageVariants.map(renderVariantCard)}
          </div>
        </div>
      )}
    </>
  );
}

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
              <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                <ZoomInIcon className="h-3.5 w-3.5" />
              </span>
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
              <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                <ZoomInIcon className="h-3.5 w-3.5" />
              </span>
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
              <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                <ZoomInIcon className="h-3.5 w-3.5" />
              </span>
            </span>
            <div className="px-2 py-1 text-xs text-gray-300">{index + collageVariants.length + 2}. Listing {index + 1}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function InstagramPostDataAside({ listing }: { listing: InstagramListingPayload }) {
  return (
    <aside className="space-y-4">
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <InstagramIcon className="h-4 w-4 text-pink-300" />
          Post data
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-gray-800 px-3 py-2">
            <div className="text-xs text-gray-500">Make</div>
            <div className="text-gray-100">{listing.make ?? "-"}</div>
          </div>
          <div className="rounded-md bg-gray-800 px-3 py-2">
            <div className="text-xs text-gray-500">Model</div>
            <div className="text-gray-100">{listing.model ?? "-"}</div>
          </div>
          <div className="rounded-md bg-gray-800 px-3 py-2">
            <div className="text-xs text-gray-500">Mileage</div>
            <div className="text-gray-100">{formatPosterMileage(listing.mileage)}</div>
          </div>
          <div className="rounded-md bg-gray-800 px-3 py-2">
            <div className="text-xs text-gray-500">Price</div>
            <div className="text-gray-100">{formatPosterPrice(listing.price)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Caption</h2>
        <textarea
          value={listing.caption}
          readOnly
          rows={16}
          className="w-full resize-y rounded-md border border-gray-700 bg-gray-950 p-3 text-sm leading-6 text-gray-200"
        />
      </div>
    </aside>
  );
}
