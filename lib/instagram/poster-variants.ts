export type PosterVariantRole = "cover" | "collage";

export interface PosterVariantPrompt {
  id: string;
  name: string;
  role?: PosterVariantRole;
  prompt: string;
}

export interface CollageSelections {
  exteriorPhotoIds: number[];
  interiorPhotoIds: number[];
}

export const PROMPT_STORAGE_PREFIX = "scrapeui:instagram-poster-prompt:";
export const VARIANT_PROMPT_STORAGE_PREFIX = "scrapeui:instagram-poster-variant-prompts:";
export const COLLAGE_SELECTION_STORAGE_PREFIX = "scrapeui:instagram-poster-collage-selections:";

export const DEFAULT_POSTER_VARIANT_PROMPTS: PosterVariantPrompt[] = [
  {
    id: "ai-hero",
    name: "AI hero",
    role: "cover",
    prompt:
      "single dramatic front three-quarter hero render, large cinematic headline, minimal premium background, strong showroom reflection.",
  },
  {
    id: "ai-motion",
    name: "AI motion",
    role: "cover",
    prompt:
      "dynamic top-down and side-profile motion poster, layered speed streaks, split composition, energetic performance ad feel.",
  },
  {
    id: "ai-editorial",
    name: "AI editorial",
    role: "cover",
    prompt:
      "clean magazine-style editorial layout, elegant negative space, refined spec blocks, calm luxury dealership campaign.",
  },
  {
    id: "ai-exterior-collage",
    name: "Exterior collage",
    role: "collage",
    prompt:
      "premium exterior collage page using the first seven outside photos as reference, same visual language as the selected poster, clean image-led layout, minimal text space.",
  },
  {
    id: "ai-interior-collage",
    name: "Interior collage",
    role: "collage",
    prompt:
      "premium interior collage page using the cabin and detail photos as reference, same visual language as the selected poster, clean image-led layout, minimal text space.",
  },
];

export const DEFAULT_POSTER_VARIANT_BY_ID = new Map(
  DEFAULT_POSTER_VARIANT_PROMPTS.map((variant) => [variant.id, variant]),
);

export function parsePosterVariantPrompts(raw: unknown) {
  if (!Array.isArray(raw)) return DEFAULT_POSTER_VARIANT_PROMPTS;
  const byId = new Map(
    raw
      .filter((item): item is { id?: unknown; prompt?: unknown } => Boolean(item && typeof item === "object"))
      .map((item) => [String(item.id ?? ""), String(item.prompt ?? "").trim()]),
  );
  return DEFAULT_POSTER_VARIANT_PROMPTS.map((variant) => ({
    ...variant,
    prompt: byId.get(variant.id) || variant.prompt,
  }));
}

function parsePhotoIdArray(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
}

export function parsePosterCollageSelections(raw: unknown): CollageSelections {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { exteriorPhotoIds: [], interiorPhotoIds: [] };
  }
  const selections = raw as { exteriorPhotoIds?: unknown; interiorPhotoIds?: unknown };
  return {
    exteriorPhotoIds: parsePhotoIdArray(selections.exteriorPhotoIds),
    interiorPhotoIds: parsePhotoIdArray(selections.interiorPhotoIds),
  };
}
