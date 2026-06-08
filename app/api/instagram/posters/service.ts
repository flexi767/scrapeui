import { buildInstagramListingPayload } from "@/lib/instagram/listing-payload";
import {
  parsePosterCollageSelections,
  parsePosterVariantPrompts,
  type CollageSelections,
  type PosterVariantPrompt,
} from "@/lib/instagram/poster-variants";
import { formatListingMileage, formatListingPrice } from "@/lib/listing-format";
import {
  getPosterImageProvider,
  type PosterImageModelConfig,
  type PosterImageProvider,
} from "./model-config";
import { generateComfyPosterVariant } from "./comfy-provider";
import { generateOpenAiPosterVariant } from "./openai-provider";
import { getReferenceImages } from "./reference-images";
export {
  getPosterImageModelOptions,
  getPosterImageProvider,
  getPosterImageProviderOptions,
  resolvePosterImageModel,
  validatePosterImageProvider,
  type PosterImageModelOption,
  type PosterImageProvider,
} from "./model-config";

export interface PosterRequestBody {
  backupId?: unknown;
  prompt?: unknown;
  force?: unknown;
  cacheOnly?: unknown;
  variantId?: unknown;
  variantPrompts?: unknown;
  collageSelections?: unknown;
  imageProvider?: unknown;
  imageModel?: unknown;
}

export interface PosterVariantResult {
  id: string;
  name: string;
  role?: "cover" | "collage";
  dataUrl: string;
}

export function parseVariantPrompts(raw: unknown) {
  return parsePosterVariantPrompts(raw);
}

export function parseVariantId(raw: unknown) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function parseCollageSelections(raw: unknown) {
  return parsePosterCollageSelections(raw);
}

export function parseImageProvider(raw: unknown) {
  return typeof raw === "string" && raw.trim() ? getPosterImageProvider(raw) : getPosterImageProvider();
}

export function parseImageModel(raw: unknown) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function buildImagePrompt(
  listing: NonNullable<ReturnType<typeof buildInstagramListingPayload>>,
  prompt: string,
  variant: PosterVariantPrompt,
) {
  const title = [listing.make, listing.model].filter(Boolean).join(" ") || listing.title;
  const specs = [
    listing.year ? `year ${listing.year}` : null,
    listing.color ? `color ${listing.color}` : null,
    listing.fuel ? `fuel ${listing.fuel}` : null,
    listing.transmission ? `transmission ${listing.transmission}` : null,
    listing.power ? `${listing.power} hp` : null,
    `mileage ${formatListingMileage(listing.mileage)}`,
    `price ${formatListingPrice(listing.price)}`,
  ].filter(Boolean);

  return [
    "Use case: product-mockup",
    `Asset type: Instagram square vehicle ${variant.role === "collage" ? "carousel collage page" : "cover poster"}`,
    `Primary request: ${prompt}`,
    `Variant direction: ${variant.prompt}`,
    `Subject: ${title}. ${specs.join(", ")}.`,
    "Style/medium: premium hyperrealistic automotive advertising, cinematic reflections, editorial car photography, high-end dealership campaign.",
    variant.role === "collage"
      ? "Composition/framing: square 1:1 Instagram carousel collage page, elegant multi-photo grid, consistent spacing, premium editorial hierarchy, very little text."
      : "Composition/framing: square 1:1 Instagram cover, dramatic vehicle hero angle, strong poster hierarchy, room for headline and offer details.",
    "Lighting/mood: cinematic reflections, polished surfaces, high-end dealership campaign.",
    "Text: do not render any letters, words, captions, contact details, logos, typography, footer text, or UI labels. All text will be added later with a consistent font.",
    "Reference fidelity: use the provided listing photos as visual references for the exact car. Preserve the visible wheel design/rims, tire proportions, and license plate text/number from the reference photos whenever they are visible. Do not invent a different number plate. Do not change the car generation, body kit, headlights, grille, or wheel style.",
    variant.id === "ai-exterior-collage"
      ? "Reference selection: use these as exterior/outside car photos. Build a collage page from the outside views."
      : null,
    variant.id === "ai-interior-collage"
      ? "Reference selection: use these as interior/cabin/detail photos. Build a collage page from the inside views."
      : null,
    variant.role === "collage"
      ? "Constraints: create a styled collage page from the provided references, not a single-car render; no watermarks; no app chrome; no browser UI."
      : "Constraints: create a fully generated poster image, not a flat UI mockup or simple photo collage; no watermarks; no app chrome; no browser UI.",
    "Avoid: mismatched wheels, altered rims, changed license plate characters, cheap flyer style, clutter, distorted car geometry, unreadable dense text, fake badges, extra logos.",
  ]
    .filter(Boolean)
    .join("\n");
}

function getVariantPhotoIds(
  listing: NonNullable<ReturnType<typeof buildInstagramListingPayload>>,
  variantId: string,
  collageSelections: { exteriorPhotoIds: number[]; interiorPhotoIds: number[] },
) {
  const listingIds = new Set(listing.photos.map((photo) => photo.id));
  const validIds = (ids: number[]) => ids.filter((id) => listingIds.has(id));
  if (variantId === "ai-exterior-collage") return validIds(collageSelections.exteriorPhotoIds);
  if (variantId === "ai-interior-collage") return validIds(collageSelections.interiorPhotoIds);
  return listing.photos.slice(0, 4).map((photo) => photo.id);
}

export async function generatePosterVariants({
  listing,
  prompt,
  model,
  provider,
  variantPrompts,
  collageSelections,
}: {
  listing: NonNullable<ReturnType<typeof buildInstagramListingPayload>>;
  prompt: string;
  model: PosterImageModelConfig;
  provider: PosterImageProvider;
  variantPrompts: PosterVariantPrompt[];
  collageSelections: CollageSelections;
}) {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  return Promise.all(
    variantPrompts.map(async (variant) => {
      const imagePrompt = buildImagePrompt(listing, prompt, variant);
      const referenceImages = getReferenceImages(getVariantPhotoIds(listing, variant.id, collageSelections));
      const dataUrl =
        provider === "comfyui"
          ? await generateComfyPosterVariant({ imagePrompt, model, referenceImages, variant })
          : await generateOpenAiPosterVariant({ imagePrompt, model: model.id, apiKey, referenceImages, variant });

      return {
        id: variant.id,
        name: variant.name,
        role: variant.role,
        dataUrl,
      };
    }),
  );
}
