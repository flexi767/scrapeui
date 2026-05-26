import { loadImage } from "@/lib/canvas-utils";
import { parseApiResponse } from "@/lib/utils";
import {
  DEFAULT_POSTER_VARIANT_PROMPTS,
  type CollageSelections,
  type InstagramListingPayload,
  type PosterVariant,
  type PosterVariantPrompt,
} from "./poster";

export type PosterGenerationOptions = {
  force?: boolean;
  cacheOnly?: boolean;
  variantId?: string;
};

export function normalizeVariantPrompts(prompts: PosterVariantPrompt[]) {
  return DEFAULT_POSTER_VARIANT_PROMPTS.map((defaultPrompt) => {
    const saved = prompts.find((prompt) => prompt.id === defaultPrompt.id);
    return {
      ...defaultPrompt,
      prompt: saved?.prompt?.trim() || defaultPrompt.prompt,
    };
  });
}

export function buildDefaultCollageSelections(photos: InstagramListingPayload["photos"]): CollageSelections {
  return {
    exteriorPhotoIds: photos.slice(0, 7).map((photo) => photo.id),
    interiorPhotoIds: photos.slice(7, 14).map((photo) => photo.id),
  };
}

export function normalizeCollageSelections(
  selections: CollageSelections,
  photos: InstagramListingPayload["photos"],
): CollageSelections {
  const photoIds = new Set(photos.map((photo) => photo.id));
  return {
    exteriorPhotoIds: selections.exteriorPhotoIds.filter((id) => photoIds.has(id)),
    interiorPhotoIds: selections.interiorPhotoIds.filter((id) => photoIds.has(id)),
  };
}

export async function loadPosterImages(photos: InstagramListingPayload["photos"]) {
  const results = await Promise.allSettled(
    photos.slice(0, 5).map((photo) => loadImage(photo.url)),
  );

  return {
    images: results
      .filter((result): result is PromiseFulfilledResult<HTMLImageElement> => result.status === "fulfilled")
      .map((result) => result.value),
    failedCount: results.filter((result) => result.status === "rejected").length,
  };
}

export async function generateAiPosters(
  backupId: number,
  prompt: string,
  variantPrompts: PosterVariantPrompt[],
  collageSelections: CollageSelections,
  options: PosterGenerationOptions = {},
) {
  const response = await fetch("/api/instagram/posters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      backupId,
      prompt,
      variantPrompts,
      collageSelections,
      variantId: options.variantId,
      force: Boolean(options.force),
      cacheOnly: Boolean(options.cacheOnly),
    }),
  });

  const data = await parseApiResponse<{ variants: PosterVariant[]; cached?: boolean; error?: string }>(
    response,
    "Could not generate AI posters",
  );
  if (data.error) throw new Error(data.error);
  if (data.variants.length === 0 && !options.cacheOnly) throw new Error("Image API returned no poster images");
  return { variants: data.variants, cached: Boolean(data.cached) };
}
