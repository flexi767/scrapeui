'use client';

import { useTranslations } from "next-intl";
import { RefreshCwIcon, ZoomInIcon } from "lucide-react";
import { type PosterVariant, type PosterVariantPrompt } from "../poster";
import { StepHeader, type ZoomImage } from "./shared";

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
  const t = useTranslations('ui');
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
            {isGenerating ? t('generating') : `${index + 1}. ${expected.name}`}
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
            {variant ? t('regenerate') : t('generate')}
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
          title={t('review_and_choose_cover')}
          detail={t('collage_pages_carousel_hint')}
        />
        <button
          type="button"
          onClick={onRegenerate}
          disabled={generating}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-gray-700 px-3 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCwIcon className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
          {t('regenerate')}
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {expectedCoverVariants.map(renderVariantCard)}
        {!hasVariants && expectedCoverVariants.length === 0 && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-sm text-gray-400">
            {generating ? t('generating_poster_options') : t('generate_posters_after_selecting')}
          </div>
        )}
      </div>

      {expectedCollageVariants.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">{t('collage_pages')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {expectedCollageVariants.map(renderVariantCard)}
          </div>
        </div>
      )}
    </>
  );
}
