import { loadImage } from "@/lib/canvas-utils";
import { parseApiResponse } from "@/lib/utils";
import {
  DEFAULT_POSTER_VARIANT_PROMPTS,
  formatPosterPrice,
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

function buildGeneratedFooter(listing: InstagramListingPayload) {
  const title = [listing.make, listing.model].filter(Boolean).join(" ") || listing.title;
  const details = [
    title,
    listing.year ? String(listing.year) : null,
    formatPosterPrice(listing.price),
    listing.city ? `Наличен в ${listing.city}` : null,
  ].filter((item): item is string => Boolean(item && item !== "-"));
  return {
    details: details.join(" • "),
    phone: listing.phone ? `Телефон: ${listing.phone}` : "",
    info: listing.phone ? "Повече информация на посочения телефон" : "Повече информация при запитване",
  };
}

async function applyBulgarianFooter(listing: InstagramListingPayload, variant: PosterVariant) {
  const image = await loadImage(variant.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width || 1024;
  canvas.height = image.naturalHeight || image.height || 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return variant;

  const width = canvas.width;
  const height = canvas.height;
  const footerHeight = Math.round(height * 0.13);
  ctx.drawImage(image, 0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, height - footerHeight * 1.45, 0, height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.35, "rgba(0,0,0,0.72)");
  gradient.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - footerHeight * 1.45, width, footerHeight * 1.45);

  const footer = buildGeneratedFooter(listing);
  const margin = Math.round(width * 0.055);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `700 ${Math.round(width * 0.025)}px Arial`;
  ctx.fillText(footer.details, margin, height - Math.round(footerHeight * 0.62), width - margin * 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(width * 0.032)}px Arial`;
  ctx.fillText(footer.phone || footer.info, margin, height - Math.round(footerHeight * 0.32), width - margin * 2);
  if (footer.phone) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `600 ${Math.round(width * 0.021)}px Arial`;
    ctx.fillText(footer.info, margin, height - Math.round(footerHeight * 0.12), width - margin * 2);
  }

  return {
    ...variant,
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
  };
}

export async function applyFootersToVariants(listing: InstagramListingPayload, variants: PosterVariant[]) {
  return Promise.all(variants.map((variant) => applyBulgarianFooter(listing, variant)));
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
