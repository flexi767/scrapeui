import { loadImage } from "@/lib/canvas-utils";
import { apiRequest } from "@/lib/utils";
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
  imageProvider?: string;
  imageModel?: string;
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

const POSTER_TEXT_FONT = "Arial, sans-serif";

function fitTextSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  weight: number,
) {
  let size = startSize;
  while (size > 16) {
    ctx.font = `${weight} ${size}px ${POSTER_TEXT_FONT}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return size;
}

function buildPosterText(listing: InstagramListingPayload) {
  const brand = listing.make?.trim() || "";
  const model = listing.model?.trim() || listing.title.replace(brand, "").trim();
  const price = formatPosterPrice(listing.price);
  const details = [
    [brand, model].filter(Boolean).join(" "),
    listing.year ? String(listing.year) : null,
    price !== "-" ? price : null,
    listing.city ? `Наличен в ${listing.city}` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    brand: brand || listing.title,
    model,
    details: details.join(" • "),
    phone: listing.phone ? `Телефон: ${listing.phone}` : "",
    info: listing.phone ? "Повече информация на посочения телефон" : "Повече информация при запитване",
  };
}

async function applyConsistentPosterText(listing: InstagramListingPayload, variant: PosterVariant) {
  const image = await loadImage(variant.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width || 1024;
  canvas.height = image.naturalHeight || image.height || 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return variant;

  const width = canvas.width;
  const height = canvas.height;
  const margin = Math.round(width * 0.055);
  const text = buildPosterText(listing);

  ctx.drawImage(image, 0, 0, width, height);

  const topGradient = ctx.createLinearGradient(0, 0, 0, height * 0.24);
  topGradient.addColorStop(0, "rgba(0,0,0,0.78)");
  topGradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, width, height * 0.24);

  const brand = text.brand.toUpperCase();
  const brandSize = fitTextSize(ctx, brand, width - margin * 2, Math.round(width * 0.055), 900);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${brandSize}px ${POSTER_TEXT_FONT}`;
  ctx.fillText(brand, margin, margin + brandSize);

  if (text.model && text.model.toLowerCase() !== text.brand.toLowerCase()) {
    const model = text.model.toUpperCase();
    const modelSize = fitTextSize(ctx, model, width - margin * 2, Math.round(width * 0.031), 700);
    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = `700 ${modelSize}px ${POSTER_TEXT_FONT}`;
    ctx.fillText(model, margin, margin + brandSize + modelSize + Math.round(width * 0.014));
  }

  const footerHeight = Math.round(height * 0.14);
  const footerGradient = ctx.createLinearGradient(0, height - footerHeight * 1.5, 0, height);
  footerGradient.addColorStop(0, "rgba(0,0,0,0)");
  footerGradient.addColorStop(0.35, "rgba(0,0,0,0.72)");
  footerGradient.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = footerGradient;
  ctx.fillRect(0, height - footerHeight * 1.5, width, footerHeight * 1.5);

  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = `700 ${Math.round(width * 0.024)}px ${POSTER_TEXT_FONT}`;
  ctx.fillText(text.details, margin, height - Math.round(footerHeight * 0.66), width - margin * 2);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(width * 0.031)}px ${POSTER_TEXT_FONT}`;
  ctx.fillText(text.phone || text.info, margin, height - Math.round(footerHeight * 0.35), width - margin * 2);

  if (text.phone) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `600 ${Math.round(width * 0.02)}px ${POSTER_TEXT_FONT}`;
    ctx.fillText(text.info, margin, height - Math.round(footerHeight * 0.14), width - margin * 2);
  }

  return {
    ...variant,
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
  };
}

export async function applyConsistentTextToVariants(listing: InstagramListingPayload, variants: PosterVariant[]) {
  return Promise.all(variants.map((variant) => applyConsistentPosterText(listing, variant)));
}

export async function generateAiPosters(
  backupId: number,
  prompt: string,
  variantPrompts: PosterVariantPrompt[],
  collageSelections: CollageSelections,
  options: PosterGenerationOptions = {},
) {
  const data = await apiRequest<{ variants: PosterVariant[]; cached?: boolean; error?: string }>(
    "/api/instagram/posters",
    "Could not generate AI posters",
    {
      method: "POST",
      json: {
        backupId,
        prompt,
        variantPrompts,
        collageSelections,
        variantId: options.variantId,
        force: Boolean(options.force),
        cacheOnly: Boolean(options.cacheOnly),
        imageProvider: options.imageProvider,
        imageModel: options.imageModel,
      },
    },
  );
  if (data.error) throw new Error(data.error);
  if (data.variants.length === 0 && !options.cacheOnly) throw new Error("Image API returned no poster images");
  return { variants: data.variants, cached: Boolean(data.cached) };
}
